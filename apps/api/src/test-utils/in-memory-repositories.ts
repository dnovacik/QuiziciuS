import { randomUUID } from 'node:crypto';
import { AnswerGradePatch, AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { InfractionRecord, InfractionsRepository } from '../data/infractions.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { QuizRecord, QuizzesRepository } from '../data/quizzes.repository';
import { ScoreAdjustmentRecord, ScoreAdjustmentsRepository } from '../data/score-adjustments.repository';
import { SessionRecord, SessionsRepository, SessionStatusPatch } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';

export class InMemorySessionsRepository extends SessionsRepository {
  private rows = new Map<string, SessionRecord>();

  async create(quizId: string, hostId: string, joinCode: string): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: randomUUID(),
      quiz_id: quizId,
      host_id: hostId,
      join_code: joinCode,
      status: 'LOBBY',
      current_question_id: null,
      question_ends_at: null,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findByJoinCode(joinCode: string): Promise<SessionRecord | null> {
    return [...this.rows.values()].find((s) => s.join_code === joinCode && s.status !== 'FINISHED') ?? null;
  }

  async updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('session not found');
    const updated = { ...existing, ...patch };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryQuestionsRepository extends QuestionsRepository {
  private rows = new Map<string, QuestionRecord>();

  async findById(id: string): Promise<QuestionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async listByQuiz(quizId: string): Promise<QuestionRecord[]> {
    return [...this.rows.values()]
      .filter((q) => q.quiz_id === quizId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  async create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord> {
    const record: QuestionRecord = { id: randomUUID(), quiz_id: quizId, ...input };
    this.rows.set(record.id, record);
    return record;
  }
}

export class InMemoryTeamsRepository extends TeamsRepository {
  private rows = new Map<string, TeamRecord>();

  async findById(teamId: string): Promise<TeamRecord | null> {
    return this.rows.get(teamId) ?? null;
  }

  async findBySessionAndName(sessionId: string, name: string): Promise<TeamRecord | null> {
    return [...this.rows.values()].find((t) => t.session_id === sessionId && t.name === name) ?? null;
  }

  async upsertJoin(sessionId: string, name: string): Promise<TeamRecord> {
    const existing = await this.findBySessionAndName(sessionId, name);
    if (existing) {
      const updated = { ...existing, is_active: true, joined_at: new Date().toISOString() };
      this.rows.set(updated.id, updated);
      return updated;
    }
    const record: TeamRecord = {
      id: randomUUID(),
      session_id: sessionId,
      name,
      device_token_hash: null,
      joined_at: new Date().toISOString(),
      is_active: true,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async setDeviceTokenHash(teamId: string, tokenHash: string): Promise<TeamRecord> {
    const existing = this.rows.get(teamId);
    if (!existing) throw new Error('team not found');
    const updated = { ...existing, device_token_hash: tokenHash };
    this.rows.set(teamId, updated);
    return updated;
  }

  async listBySession(sessionId: string): Promise<TeamRecord[]> {
    return [...this.rows.values()].filter((t) => t.session_id === sessionId);
  }
}

export class InMemoryAnswersRepository extends AnswersRepository {
  private rows = new Map<string, AnswerRecord>();

  async upsertSubmission(input: {
    sessionId: string;
    questionId: string;
    teamId: string;
    response: unknown;
  }): Promise<AnswerRecord> {
    const existing = [...this.rows.values()].find(
      (a) => a.session_id === input.sessionId && a.question_id === input.questionId && a.team_id === input.teamId,
    );
    if (existing) {
      const updated = { ...existing, response: input.response, submitted_at: new Date().toISOString() };
      this.rows.set(updated.id, updated);
      return updated;
    }
    const record: AnswerRecord = {
      id: randomUUID(),
      session_id: input.sessionId,
      question_id: input.questionId,
      team_id: input.teamId,
      response: input.response,
      is_correct: null,
      confidence: null,
      needs_review: false,
      graded_by: null,
      graded_at: null,
      submitted_at: new Date().toISOString(),
      score_awarded: 0,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<AnswerRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async listByQuestion(sessionId: string, questionId: string): Promise<AnswerRecord[]> {
    return [...this.rows.values()].filter((a) => a.session_id === sessionId && a.question_id === questionId);
  }

  async listNeedsReview(sessionId: string): Promise<AnswerRecord[]> {
    return [...this.rows.values()].filter((a) => a.session_id === sessionId && a.needs_review);
  }

  async listBySession(sessionId: string): Promise<AnswerRecord[]> {
    return [...this.rows.values()].filter((a) => a.session_id === sessionId);
  }

  async updateGrade(id: string, patch: AnswerGradePatch): Promise<AnswerRecord> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('answer not found');
    const updated = { ...existing, ...patch, graded_at: patch.graded_at ?? new Date().toISOString() };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryInfractionsRepository extends InfractionsRepository {
  private rows: InfractionRecord[] = [];

  async create(sessionId: string, teamId: string, type: InfractionRecord['type']): Promise<InfractionRecord> {
    const record: InfractionRecord = {
      id: randomUUID(),
      session_id: sessionId,
      team_id: teamId,
      type,
      detected_at: new Date().toISOString(),
      reviewed: false,
    };
    this.rows.push(record);
    return record;
  }

  async findById(infractionId: string): Promise<InfractionRecord | null> {
    return this.rows.find((i) => i.id === infractionId) ?? null;
  }

  async listBySession(sessionId: string): Promise<InfractionRecord[]> {
    return this.rows.filter((i) => i.session_id === sessionId);
  }

  async markReviewed(infractionId: string): Promise<InfractionRecord> {
    const index = this.rows.findIndex((i) => i.id === infractionId);
    if (index === -1) throw new Error('infraction not found');
    const updated = { ...this.rows[index], reviewed: true };
    this.rows[index] = updated;
    return updated;
  }
}

export class InMemoryScoreAdjustmentsRepository extends ScoreAdjustmentsRepository {
  private rows: ScoreAdjustmentRecord[] = [];

  async create(sessionId: string, teamId: string, points: number, reason: string | null): Promise<ScoreAdjustmentRecord> {
    const record: ScoreAdjustmentRecord = {
      id: randomUUID(),
      session_id: sessionId,
      team_id: teamId,
      points,
      reason,
      created_at: new Date().toISOString(),
    };
    this.rows.push(record);
    return record;
  }

  async listBySession(sessionId: string): Promise<ScoreAdjustmentRecord[]> {
    return this.rows.filter((r) => r.session_id === sessionId);
  }
}

export class InMemoryQuizzesRepository extends QuizzesRepository {
  private rows = new Map<string, QuizRecord>();

  async create(hostId: string, title: string): Promise<QuizRecord> {
    const record: QuizRecord = {
      id: randomUUID(),
      host_id: hostId,
      league_id: null,
      title,
      created_at: new Date().toISOString(),
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<QuizRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async listByHost(hostId: string): Promise<QuizRecord[]> {
    return [...this.rows.values()].filter((q) => q.host_id === hostId);
  }
}
