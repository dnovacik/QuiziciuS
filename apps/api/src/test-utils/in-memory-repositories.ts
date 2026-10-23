import { randomUUID } from 'node:crypto';
import { AnswerGradePatch, AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { InfractionRecord, InfractionsRepository } from '../data/infractions.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { QuizPatch, QuizRecord, QuizzesRepository } from '../data/quizzes.repository';
import { ScoreAdjustmentRecord, ScoreAdjustmentsRepository } from '../data/score-adjustments.repository';
import { SessionRecord, SessionsRepository, SessionStatusPatch } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { NewPub, PubRecord, PubsRepository, pubKey, TeamPubRecord } from '../data/pubs.repository';

export class InMemorySessionsRepository extends SessionsRepository {
  private rows = new Map<string, SessionRecord>();

  async create(quizId: string, hostId: string, joinCode: string, pubId: string | null = null): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: randomUUID(),
      quiz_id: quizId,
      host_id: hostId,
      join_code: joinCode,
      status: 'LOBBY',
      pub_id: pubId,
      current_question_id: null,
      question_ends_at: null,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async listByHost(hostId: string): Promise<SessionRecord[]> {
    return [...this.rows.values()].filter((row) => row.host_id === hostId);
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
    return [...this.rows.values()].filter((q) => q.quiz_id === quizId).sort((a, b) => a.order_index - b.order_index);
  }

  async create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord> {
    const record: QuestionRecord = { id: randomUUID(), quiz_id: quizId, ...input };
    this.rows.set(record.id, record);
    return record;
  }
  async update(quizId: string, id: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord | null> {
    const record = this.rows.get(id);
    if (!record || record.quiz_id !== quizId) return null;
    const updated = { ...record, ...input };
    this.rows.set(id, updated);
    return updated;
  }
  async remove(quizId: string, id: string): Promise<boolean> {
    const record = this.rows.get(id);
    if (!record || record.quiz_id !== quizId) return false;
    return this.rows.delete(id);
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

  async findBySessionAndRegisteredTeam(sessionId: string, registeredTeamId: string): Promise<TeamRecord | null> {
    return [...this.rows.values()].find((t) => t.session_id === sessionId && t.registered_team_id === registeredTeamId) ?? null;
  }

  async upsertJoin(sessionId: string, name: string, registeredTeamId: string | null = null): Promise<TeamRecord> {
    const existing = await this.findBySessionAndName(sessionId, name);
    if (existing) {
      const updated = {
        ...existing,
        is_active: true,
        joined_at: new Date().toISOString(),
        registered_team_id: registeredTeamId ?? existing.registered_team_id,
      };
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
      registered_team_id: registeredTeamId,
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

  async upsertSubmission(input: { sessionId: string; questionId: string; teamId: string; response: unknown }): Promise<AnswerRecord> {
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

  async create(hostId: string, title: string, categoryId: string | null, pubId: string | null = null): Promise<QuizRecord> {
    const record: QuizRecord = {
      id: randomUUID(),
      host_id: hostId,
      league_id: null,
      category_id: categoryId,
      pub_id: pubId,
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

  async update(id: string, patch: QuizPatch): Promise<QuizRecord> {
    const record = { ...this.rows.get(id)!, ...patch };
    this.rows.set(id, record);
    return record;
  }

  async remove(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

export class InMemoryPubsRepository extends PubsRepository {
  readonly pubs = new Map<string, PubRecord>();
  readonly hostPubs = new Map<string, Set<string>>();
  readonly teamPubs = new Map<string, { pubIds: string[]; primary: string | null }>();

  async search(query: string | null): Promise<PubRecord[]> {
    const term = query?.trim().toLowerCase() ?? '';
    return [...this.pubs.values()]
      .filter((pub) => !term || pub.name.toLowerCase().includes(term) || pub.city.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: string): Promise<PubRecord | null> {
    return this.pubs.get(id) ?? null;
  }

  async findByKey(name: string, city: string): Promise<PubRecord | null> {
    return [...this.pubs.values()].find((pub) => pubKey(pub.name, pub.city) === pubKey(name, city)) ?? null;
  }

  async create(pub: NewPub): Promise<PubRecord> {
    const record: PubRecord = { id: randomUUID(), ...pub, created_at: new Date().toISOString() };
    this.pubs.set(record.id, record);
    return record;
  }

  async listForHost(hostId: string): Promise<PubRecord[]> {
    return [...(this.hostPubs.get(hostId) ?? [])].map((id) => this.pubs.get(id)!);
  }

  async linkHost(hostId: string, pubId: string): Promise<void> {
    this.hostPubs.set(hostId, (this.hostPubs.get(hostId) ?? new Set()).add(pubId));
  }

  async unlinkHost(hostId: string, pubId: string): Promise<void> {
    this.hostPubs.get(hostId)?.delete(pubId);
  }

  async listForTeam(teamId: string): Promise<TeamPubRecord[]> {
    const entry = this.teamPubs.get(teamId);
    if (!entry) return [];
    return entry.pubIds.map((id) => ({ ...this.pubs.get(id)!, is_primary: id === entry.primary }));
  }

  async setTeamPubs(teamId: string, pubIds: string[], primaryPubId: string | null): Promise<void> {
    this.teamPubs.set(teamId, { pubIds, primary: primaryPubId });
  }
}
