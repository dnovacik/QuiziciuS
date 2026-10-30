import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  /** PAUSE_BREAK only: the break's planned length and a message for the room. */
  breakMinutes?: number;
  breakMessage?: string;
}

export type TimerAction = 'pause' | 'resume' | 'extend';
/** How much "+ time" adds when the host does not say. */
export const DEFAULT_EXTEND_SECONDS = 10;

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

  async createSession(quizId: string, hostId: string, pubId: string | null = null, leagueId: string | null = null): Promise<SessionRecord> {
    return this.sessions.create(quizId, hostId, generateJoinCode(), pubId, leagueId);
  }

  async getState(sessionId: string, includePrivateScores = false): Promise<QuizSessionStateDto> {
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
    // Only how many teams answered, never who or what: that is safe while answering is open.
    const answering = session.status === 'QUESTION_ACTIVE' || session.status === 'QUESTION_REVEAL';
    const answeredCount =
      answering && session.current_question_id
        ? new Set(answers.filter((answer) => answer.question_id === session.current_question_id).map((answer) => answer.team_id)).size
        : null;

    return {
      id: session.id,
      joinCode: session.join_code,
      scoresVisible: session.scores_visible ?? false,
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
            unit: question.unit ?? null,
          }
        : null,
      questionEndsAt: session.question_ends_at,
      questionPausedAt: session.question_paused_at ?? null,
      answeredCount,
      playedQuestionIds: session.played_question_ids ?? [],
      breakEndsAt: session.status === 'PAUSE_BREAK' ? (session.break_ends_at ?? null) : null,
      breakMessage: session.status === 'PAUSE_BREAK' ? (session.break_message ?? null) : null,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        isActive: team.is_active,
        registeredTeamId: team.registered_team_id ?? null,
        tableNumber: team.table_number ?? null,
        ready: readyFor !== null && team.ready_question_id === readyFor,
        readyFullscreen: readyFor !== null && team.ready_question_id === readyFor && team.ready_fullscreen,
        score: includePrivateScores || session.scores_visible || session.status === 'FINISHED' ? (scoreByTeam.get(team.id) ?? 0) : 0,
        infractionCount: infractionCountByTeam.get(team.id) ?? 0,
      })),
    };
  }

  async setScoreVisibility(sessionId: string, hostId: string, visible: boolean): Promise<SessionRecord> {
    await this.requireOwnedSession(sessionId, hostId);
    const updated = await this.sessions.updateStatus(sessionId, { scores_visible: visible });
    await this.publishState(updated);
    return updated;
  }

  async transitionState(sessionId: string, hostId: string, newState: QuizState, options: TransitionOptions = {}): Promise<SessionRecord> {
    const session = await this.requireOwnedSession(sessionId, hostId);
    assertValidTransition(session.status, newState);

    // A pause belongs to one question, and break details to one break.
    const patch: Parameters<SessionsRepository['updateStatus']>[1] = {
      status: newState,
      question_paused_at: null,
      break_ends_at: null,
      break_message: null,
    };

    if (newState === 'PAUSE_BREAK') {
      if (options.breakMinutes) patch.break_ends_at = new Date(Date.now() + options.breakMinutes * 60_000).toISOString();
      patch.break_message = options.breakMessage?.trim() || null;
    }

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
      const played = session.played_question_ids ?? [];
      if (!played.includes(questionId)) patch.played_question_ids = [...played, questionId];
      // A question without a time limit has no deadline: answering stays open until the host closes it.
      patch.question_ends_at =
        question.time_limit_seconds > 0 ? new Date(Date.now() + question.time_limit_seconds * 1000).toISOString() : null;
    }

    if (newState === 'FINISHED') {
      patch.finished_at = new Date().toISOString();
    }

    const updated = await this.sessions.updateStatus(sessionId, patch);

    if (newState === 'QUESTION_REVEAL' && updated.current_question_id) {
      await this.gradeNumericAnswers(updated.id, updated.current_question_id);
    }

    await this.publishState(updated);
    return updated;
  }

  /**
   * Stops answering for the open question now (an untimed question, or a timed one ended early).
   * The deadline moves to now, so the usual late-submission grace and result visibility apply.
   */
  async closeAnswers(sessionId: string, hostId: string): Promise<SessionRecord> {
    const session = await this.requireOwnedSession(sessionId, hostId);
    if (session.status !== 'QUESTION_ACTIVE') {
      throw new ConflictException({ code: 'NO_OPEN_QUESTION', message: 'No question is open for answers' });
    }
    if (session.question_ends_at && !session.question_paused_at && Date.parse(session.question_ends_at) <= Date.now()) return session;

    const updated = await this.sessions.updateStatus(sessionId, { question_ends_at: new Date().toISOString(), question_paused_at: null });
    await this.publishState(updated);
    return updated;
  }

  /**
   * The host's timer controls for the open, timed question: pause and resume the countdown, or add
   * time. A question whose time has run out stays closed: teams may already have seen their result.
   */
  async controlTimer(sessionId: string, hostId: string, action: TimerAction, seconds = DEFAULT_EXTEND_SECONDS): Promise<SessionRecord> {
    const session = await this.requireOwnedSession(sessionId, hostId);
    if (session.status !== 'QUESTION_ACTIVE' || !session.question_ends_at) {
      throw new ConflictException({ code: 'NO_RUNNING_TIMER', message: 'No question timer is running' });
    }
    const now = Date.now();
    const endsAt = Date.parse(session.question_ends_at);
    const pausedAt = session.question_paused_at ? Date.parse(session.question_paused_at) : null;
    if (pausedAt === null && endsAt <= now) {
      throw new ConflictException({ code: 'ANSWERS_CLOSED', message: 'Answering has already closed' });
    }

    let patch: Parameters<SessionsRepository['updateStatus']>[1];
    if (action === 'pause') {
      if (pausedAt !== null) return session;
      patch = { question_paused_at: new Date(now).toISOString() };
    } else if (action === 'resume') {
      if (pausedAt === null) return session;
      patch = { question_ends_at: new Date(endsAt + (now - pausedAt)).toISOString(), question_paused_at: null };
    } else {
      patch = { question_ends_at: new Date(endsAt + seconds * 1000).toISOString() };
    }

    const updated = await this.sessions.updateStatus(sessionId, patch);
    await this.publishState(updated);
    return updated;
  }

  /** Files a finished night away from the sessions list (or brings it back). */
  async setArchived(sessionId: string, hostId: string, archived: boolean): Promise<SessionRecord> {
    const session = await this.requireOwnedSession(sessionId, hostId);
    if (session.status !== 'FINISHED') {
      throw new ConflictException({ code: 'NOT_FINISHED', message: 'Only a finished quiz night can be archived' });
    }
    return this.sessions.updateStatus(sessionId, { archived_at: archived ? new Date().toISOString() : null });
  }

  /** Host-controlled answer correction, separate from independent bonus and penalty scores. */
  async overrideAnswerGrade(answerId: string, hostId: string, isCorrect: boolean, points: number): Promise<AnswerRecord> {
    const answer = await this.answers.findById(answerId);
    if (!answer) throw new NotFoundException('Answer not found');
    const session = await this.requireOwnedSession(answer.session_id, hostId);
    if (session.status === 'QUESTION_ACTIVE' && session.current_question_id === answer.question_id) {
      throw new ConflictException('Reveal the question before changing grades');
    }
    const question = await this.questions.findById(answer.question_id);
    if (!question || question.quiz_id !== session.quiz_id) throw new NotFoundException('Question not found');
    if (!Number.isInteger(points) || points < 0 || points > question.points) {
      throw new BadRequestException('Points must be between zero and the question maximum');
    }
    if (!isCorrect && points !== 0) throw new BadRequestException('Incorrect answers must receive zero points');
    const updated = await this.answers.overrideGrade(answerId, hostId, isCorrect, points);
    await this.broadcast.publish(session.id, 'SCORE_UPDATE', { teamId: answer.team_id, answerId });
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

    const byTeamId = new Map(rankable.map((p) => [p.answer.team_id, p.answer.id]));
    for (const result of graded) {
      const answerId = byTeamId.get(result.teamId);
      if (!answerId) continue;
      await this.answers.updateGrade(answerId, {
        is_correct: result.isCorrect,
        graded_by: 'AUTO',
        score_awarded: result.isCorrect ? question.points : 0,
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

  private publishState(session: SessionRecord): Promise<void> {
    return this.broadcast.publish(session.id, 'STATE_CHANGE', {
      status: session.status,
      currentQuestionId: session.current_question_id,
      questionEndsAt: session.question_ends_at,
      questionPausedAt: session.question_paused_at ?? null,
    });
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
