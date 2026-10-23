import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AnswerSummaryDto } from '@quizicius/shared-types';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { gradeFreeText } from '../quiz-engine/grading/free-text-grader';
import { gradeMultipleChoice } from '../quiz-engine/grading/multiple-choice-grader';
import { isAnswerResultVisible, RESULT_GRACE_MS } from '../quiz-engine/result-visibility';
import { toAnswerSummary } from './answer-summary';

const LATE_SUBMISSION_GRACE_MS = RESULT_GRACE_MS;

export interface SubmitResponseInput {
  optionId?: string;
  text?: string;
  value?: number;
}

@Injectable()
export class AnswersService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly answers: AnswersRepository,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async submit(
    sessionId: string,
    teamId: string,
    questionId: string,
    response: SubmitResponseInput,
  ): Promise<AnswerSummaryDto> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'QUESTION_ACTIVE' || session.current_question_id !== questionId) {
      throw new BadRequestException('This question is not currently active');
    }
    if (session.question_ends_at) {
      const deadline = new Date(session.question_ends_at).getTime() + LATE_SUBMISSION_GRACE_MS;
      if (Date.now() > deadline) {
        throw new UnprocessableEntityException('Submission window has closed');
      }
    }

    const question = await this.questions.findById(questionId);
    if (!question) throw new NotFoundException('Question not found');

    const saved = await this.answers.upsertSubmission({ sessionId, questionId, teamId, response });
    const graded = await this.gradeImmediately(question, saved);

    await this.broadcast.publish(sessionId, 'SCORE_UPDATE', { teamId });
    // The grade stays hidden until the question closes: answers can be resubmitted while the
    // question is open, so returning it here would let a team probe for the correct option.
    return toAnswerSummary(graded, false);
  }

  /** The team's own answers in this session; grading is included only where results are public. */
  async listForTeam(sessionId: string, teamId: string): Promise<AnswerSummaryDto[]> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    const answers = await this.answers.listBySession(sessionId);
    return answers
      .filter((answer) => answer.team_id === teamId)
      .map((answer) => toAnswerSummary(answer, isAnswerResultVisible(answer, session)));
  }

  private async gradeImmediately(question: QuestionRecord, answer: AnswerRecord): Promise<AnswerRecord> {
    if (question.type === 'MULTIPLE_CHOICE') {
      const selectedOptionId = (answer.response as SubmitResponseInput).optionId ?? '';
      const correctOptionId = question.options?.find((o) => o.isCorrect)?.id ?? '';
      const isCorrect = gradeMultipleChoice(selectedOptionId, correctOptionId);
      return this.answers.updateGrade(answer.id, {
        is_correct: isCorrect,
        graded_by: 'AUTO',
        score_awarded: isCorrect ? question.points : 0,
      });
    }

    if (question.type === 'FREE_TEXT') {
      const text = (answer.response as SubmitResponseInput).text ?? '';
      const result = gradeFreeText(text, question.accepted_answers ?? []);
      return this.answers.updateGrade(answer.id, {
        is_correct: result.isCorrect,
        confidence: result.confidence,
        needs_review: result.needsReview,
        graded_by: result.needsReview ? null : 'AUTO',
        score_awarded: result.isCorrect ? question.points : 0,
      });
    }

    // NUMERIC_NEAREST is graded once the round closes (QuizEngineService, on QUESTION_REVEAL).
    return answer;
  }
}
