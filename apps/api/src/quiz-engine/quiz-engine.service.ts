import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnswerSummaryDto, QuizSessionStateDto, QuizState } from '@quizicius/shared-types';
import { toAnswerSummary } from '../answers/answer-summary';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { InfractionsRepository } from '../data/infractions.repository';
import { QuestionsRepository } from '../data/questions.repository';
import { ScoreAdjustmentRecord, ScoreAdjustmentsRepository } from '../data/score-adjustments.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { TeamsRepository } from '../data/teams.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { gradeNumericNearest } from './grading/numeric-grader';
import { generateJoinCode } from './join-code';
import { assertValidTransition } from './state-transitions';
import { isAnswerResultVisible } from './result-visibility';

export interface TransitionOptions {
  questionId?: string;
}

@Injectable()
export class QuizEngineService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly teams: TeamsRepository,
    private readonly answers: AnswersRepository,
    private readonly infractions: InfractionsRepository,
    private readonly scoreAdjustments: ScoreAdjustmentsRepository,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async createSession(quizId: string, hostId: string, pubId: string | null = null): Promise<SessionRecord> {
    return this.sessions.create(quizId, hostId, generateJoinCode(), pubId);
  }

  async getState(sessionId: string): Promise<QuizSessionStateDto> {
    const session = await this.requireSession(sessionId);
    const [question, teams, answers, infractions, scoreAdjustments] = await Promise.all([
      session.current_question_id ? this.questions.findById(session.current_question_id) : Promise.resolve(null),
      this.teams.listBySession(sessionId),
      this.answers.listBySession(sessionId),
      this.infractions.listBySession(sessionId),
      this.scoreAdjustments.listBySession(sessionId),
    ]);

    const scoreByTeam = new Map<string, number>();
    for (const answer of answers) {
      if (!isAnswerResultVisible(answer, session)) continue;
      scoreByTeam.set(answer.team_id, (scoreByTeam.get(answer.team_id) ?? 0) + answer.score_awarded);
    }
    for (const adjustment of scoreAdjustments) {
      scoreByTeam.set(adjustment.team_id, (scoreByTeam.get(adjustment.team_id) ?? 0) + adjustment.points);
    }

    const infractionCountByTeam = new Map<string, number>();
    for (const infraction of infractions) {
      infractionCountByTeam.set(infraction.team_id, (infractionCountByTeam.get(infraction.team_id) ?? 0) + 1);
    }

    // Readiness only means something while the current question is locked in.
    const readyFor = session.status === 'LOCK_IN_ROUND' ? session.current_question_id : null;
    const revealSafe = (['QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED'] as QuizState[]).includes(session.status);

    return {
      id: session.id,
      joinCode: session.join_code,
      status: session.status,
      currentQuestion: question
        ? {
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            options: question.options ? question.options.map(({ id, label }) => ({ id, label })) : null,
            points: question.points,
            timeLimitSeconds: question.time_limit_seconds,
            orderIndex: question.order_index,
            correctOptionId: revealSafe ? (question.options?.find((o) => o.isCorrect)?.id ?? null) : null,
            correctNumeric: revealSafe ? question.correct_numeric : null,
            acceptedAnswers: revealSafe ? question.accepted_answers : null,
          }
        : null,
      questionEndsAt: session.question_ends_at,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        isActive: team.is_active,
        registeredTeamId: team.registered_team_id ?? null,
        ready: readyFor !== null && team.ready_question_id === readyFor,
        readyFullscreen: readyFor !== null && team.ready_question_id === readyFor && team.ready_fullscreen,
        score: scoreByTeam.get(team.id) ?? 0,
        infractionCount: infractionCountByTeam.get(team.id) ?? 0,
      })),
    };
  }

  async transitionState(sessionId: string, hostId: string, newState: QuizState, options: TransitionOptions = {}): Promise<SessionRecord> {
    const session = await this.requireOwnedSession(sessionId, hostId);
    assertValidTransition(session.status, newState);

    const patch: Parameters<SessionsRepository['updateStatus']>[1] = { status: newState };

    if (newState === 'LOCK_IN_ROUND') {
      if (!options.questionId) {
        throw new BadRequestException('questionId is required to start a lock-in round');
      }
      // Without this check an authenticated host could point their own session at
      // another tenant's question and read its answer back at QUESTION_REVEAL.
      const question = await this.questions.findById(options.questionId);
      if (!question) throw new NotFoundException('Question not found');
      if (question.quiz_id !== session.quiz_id) {
        throw new ForbiddenException('Question does not belong to this session quiz');
      }
      patch.current_question_id = options.questionId;
      if (!session.started_at) {
        patch.started_at = new Date().toISOString();
      }
    }

    if (newState === 'QUESTION_ACTIVE') {
      const questionId = session.current_question_id;
      if (!questionId) throw new BadRequestException('No question selected for this session');
      const question = await this.questions.findById(questionId);
      if (!question) throw new NotFoundException('Question not found');
      patch.question_ends_at = new Date(Date.now() + question.time_limit_seconds * 1000).toISOString();
    }

    if (newState === 'FINISHED') {
      patch.finished_at = new Date().toISOString();
    }

    const updated = await this.sessions.updateStatus(sessionId, patch);

    if (newState === 'QUESTION_REVEAL' && updated.current_question_id) {
      await this.gradeNumericAnswers(updated.id, updated.current_question_id);
    }

    await this.broadcast.publish(sessionId, 'STATE_CHANGE', {
      status: updated.status,
      currentQuestionId: updated.current_question_id,
      questionEndsAt: updated.question_ends_at,
    });

    return updated;
  }

  async resolveDispute(answerId: string, hostId: string, decision: 'APPROVE' | 'REJECT'): Promise<AnswerRecord> {
    const answer = await this.answers.findById(answerId);
    if (!answer) throw new NotFoundException('Answer not found');

    const session = await this.requireOwnedSession(answer.session_id, hostId);
    const question = await this.questions.findById(answer.question_id);
    if (!question) throw new NotFoundException('Question not found');

    const isCorrect = decision === 'APPROVE';
    const updated = await this.answers.updateGrade(answerId, {
      is_correct: isCorrect,
      needs_review: false,
      graded_by: 'HOST',
      score_awarded: isCorrect ? question.points : 0,
    });

    await this.broadcast.publish(session.id, 'SCORE_UPDATE', { teamId: answer.team_id, answerId: updated.id });
    return updated;
  }

  async listDisputes(sessionId: string, hostId: string): Promise<AnswerSummaryDto[]> {
    await this.requireOwnedSession(sessionId, hostId);
    return (await this.answers.listNeedsReview(sessionId)).map((answer) => toAnswerSummary(answer));
  }

  /** Every team's answers in the session (optionally for one question), graded — for the host only. */
  async listAnswers(sessionId: string, hostId: string, questionId?: string): Promise<AnswerSummaryDto[]> {
    await this.requireOwnedSession(sessionId, hostId);
    const answers = questionId ? await this.answers.listByQuestion(sessionId, questionId) : await this.answers.listBySession(sessionId);
    return answers.map((answer) => toAnswerSummary(answer));
  }

  async addPaperScore(
    sessionId: string,
    hostId: string,
    teamId: string,
    points: number,
    reason: string | null,
  ): Promise<ScoreAdjustmentRecord> {
    await this.requireOwnedSession(sessionId, hostId);
    const adjustment = await this.scoreAdjustments.create(sessionId, teamId, points, reason);
    await this.broadcast.publish(sessionId, 'SCORE_UPDATE', { teamId });
    return adjustment;
  }

  private async gradeNumericAnswers(sessionId: string, questionId: string): Promise<void> {
    const question = await this.questions.findById(questionId);
    if (!question || question.type !== 'NUMERIC_NEAREST' || question.correct_numeric === null) return;

    const submitted = await this.answers.listByQuestion(sessionId, questionId);

    // A malformed submission parses to NaN, and a single NaN poisons Math.min() in the
    // nearest-value ranking, making `distance === minDistance` false for every team —
    // one bad answer would otherwise zero the whole round. Grade those as plain
    // incorrect answers and keep them out of the ranking entirely.
    const parsed = submitted.map((a) => ({
      answer: a,
      value: Number((a.response as { value?: unknown } | null)?.value),
    }));
    const rankable = parsed.filter((p) => Number.isFinite(p.value));
    const malformed = parsed.filter((p) => !Number.isFinite(p.value));

    const graded = gradeNumericNearest(
      rankable.map((p) => ({ teamId: p.answer.team_id, value: p.value })),
      question.correct_numeric,
    );
    const winnerCount = graded.filter((g) => g.isCorrect).length || 1;
    const pointsPerWinner = Math.floor(question.points / winnerCount);

    const byTeamId = new Map(rankable.map((p) => [p.answer.team_id, p.answer.id]));
    for (const result of graded) {
      const answerId = byTeamId.get(result.teamId);
      if (!answerId) continue;
      await this.answers.updateGrade(answerId, {
        is_correct: result.isCorrect,
        graded_by: 'AUTO',
        score_awarded: result.isCorrect ? pointsPerWinner : 0,
      });
    }

    for (const { answer } of malformed) {
      await this.answers.updateGrade(answer.id, {
        is_correct: false,
        graded_by: 'AUTO',
        score_awarded: 0,
      });
    }

    await this.broadcast.publish(sessionId, 'SCORE_UPDATE', { questionId });
  }

  private async requireSession(sessionId: string): Promise<SessionRecord> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async requireOwnedSession(sessionId: string, hostId: string): Promise<SessionRecord> {
    const session = await this.requireSession(sessionId);
    if (session.host_id !== hostId) throw new ForbiddenException('Not your session');
    return session;
  }
}
