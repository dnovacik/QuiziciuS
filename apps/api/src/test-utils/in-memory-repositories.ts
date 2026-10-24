import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AccountRole } from '@quizicius/shared-types';
import { AnswerGradePatch, AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { InfractionRecord, InfractionsRepository } from '../data/infractions.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { QuizPatch, QuizRecord, QuizzesRepository } from '../data/quizzes.repository';
import { ScoreAdjustmentRecord, ScoreAdjustmentsRepository } from '../data/score-adjustments.repository';
import { SessionRecord, SessionsRepository, SessionStatusPatch } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { ProfilePatch, ProfileRecord, ProfilesRepository } from '../data/profiles.repository';
import {
  MAX_ROSTER,
  NewRegisteredTeam,
  RegisteredTeamPatch,
  RegisteredTeamPlayerRecord,
  RegisteredTeamRecord,
  RegisteredTeamsRepository,
} from '../data/registered-teams.repository';
import {
  LeagueHostRecord,
  LeaguePatch,
  LeaguePubRecord,
  LeagueRecord,
  LeagueResultRecord,
  LeaguesRepository,
  LeagueTeamRecord,
  NewLeague,
  PubTeam,
} from '../data/leagues.repository';
import { LeagueHostStatus, LeagueTeamStatus } from '@quizicius/shared-types';
import { NewPub, PubRecord, PubsRepository, pubKey, TeamPubRecord } from '../data/pubs.repository';

export class InMemorySessionsRepository extends SessionsRepository {
  private rows = new Map<string, SessionRecord>();

  async create(
    quizId: string,
    hostId: string,
    joinCode: string,
    pubId: string | null = null,
    leagueId: string | null = null,
  ): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: randomUUID(),
      quiz_id: quizId,
      host_id: hostId,
      join_code: joinCode,
      status: 'LOBBY',
      pub_id: pubId,
      league_id: leagueId,
      current_question_id: null,
      question_ends_at: null,
      question_paused_at: null,
      break_ends_at: null,
      break_message: null,
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

  async listByLeague(leagueId: string): Promise<SessionRecord[]> {
    return [...this.rows.values()].filter((row) => row.league_id === leagueId);
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

  async upsertJoin(
    sessionId: string,
    name: string,
    registeredTeamId: string | null = null,
    tableNumber: string | null = null,
  ): Promise<TeamRecord> {
    const existing = await this.findBySessionAndName(sessionId, name);
    if (existing) {
      const updated = {
        ...existing,
        is_active: true,
        joined_at: new Date().toISOString(),
        registered_team_id: registeredTeamId ?? existing.registered_team_id,
        table_number: tableNumber ?? existing.table_number ?? null,
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
      ready_question_id: null,
      ready_fullscreen: false,
      table_number: tableNumber,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async markReady(teamId: string, questionId: string, fullscreen: boolean): Promise<TeamRecord> {
    const existing = this.rows.get(teamId);
    if (!existing) throw new Error('team not found');
    const updated = { ...existing, ready_question_id: questionId, ready_fullscreen: fullscreen };
    this.rows.set(teamId, updated);
    return updated;
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

  async listByRegisteredTeam(registeredTeamId: string): Promise<TeamRecord[]> {
    return [...this.rows.values()].filter((t) => t.registered_team_id === registeredTeamId);
  }

  async linkRegistered(teamId: string, registeredTeamId: string, name: string): Promise<TeamRecord> {
    const updated = { ...this.rows.get(teamId)!, registered_team_id: registeredTeamId, name };
    this.rows.set(teamId, updated);
    return updated;
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
      disputed_at: null,
      dispute_note: null,
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

  async markDisputed(id: string, note: string | null): Promise<AnswerRecord> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('answer not found');
    const updated = { ...existing, needs_review: true, disputed_at: new Date().toISOString(), dispute_note: note };
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
      category_id: categoryId,
      pub_id: pubId,
      default_time_limit_seconds: 30,
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

export class InMemoryProfilesRepository extends ProfilesRepository {
  readonly rows = new Map<string, ProfileRecord>();

  add(id: string, role: AccountRole, email: string | null = `${id}@example.com`): ProfileRecord {
    const record: ProfileRecord = {
      id,
      display_name: email ?? id,
      email,
      role,
      deactivated_at: null,
      subscribed_until: null,
      subscription_forever: false,
      subscription_trial: false,
      created_at: new Date().toISOString(),
    };
    this.rows.set(id, record);
    return record;
  }

  async findById(id: string): Promise<ProfileRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<ProfileRecord | null> {
    return [...this.rows.values()].find((row) => row.email?.toLowerCase() === email.trim().toLowerCase()) ?? null;
  }

  async listByRoles(roles: AccountRole[]): Promise<ProfileRecord[]> {
    return [...this.rows.values()].filter((row) => roles.includes(row.role));
  }

  async update(id: string, patch: ProfilePatch): Promise<ProfileRecord> {
    const updated = { ...this.rows.get(id)!, ...patch };
    this.rows.set(id, updated);
    return updated;
  }
}

/** Mirrors the database rules: case-insensitive unique team names and player names, roster limit. */
export class InMemoryRegisteredTeamsRepository extends RegisteredTeamsRepository {
  readonly rows = new Map<string, RegisteredTeamRecord>();
  readonly players = new Map<string, (RegisteredTeamPlayerRecord & { team_id: string })[]>();

  private assertNameFree(name: string, exceptId?: string): void {
    const normalized = name.trim().toLowerCase();
    if ([...this.rows.values()].some((row) => row.normalized_name === normalized && row.id !== exceptId)) {
      throw new ConflictException({ code: 'NAME_TAKEN' });
    }
  }

  private assertPlayerFree(teamId: string, name: string, exceptId?: string): void {
    const normalized = name.trim().toLowerCase();
    if ((this.players.get(teamId) ?? []).some((p) => p.name.toLowerCase() === normalized && p.id !== exceptId)) {
      throw new ConflictException({ code: 'PLAYER_EXISTS' });
    }
  }

  async listByCaptain(captainId: string): Promise<RegisteredTeamRecord[]> {
    return [...this.rows.values()].filter((row) => row.captain_id === captainId).reverse();
  }

  async findById(id: string): Promise<RegisteredTeamRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async isNameTaken(name: string): Promise<boolean> {
    const normalized = name.trim().toLowerCase();
    return [...this.rows.values()].some((row) => row.normalized_name === normalized);
  }

  async create(team: NewRegisteredTeam): Promise<RegisteredTeamRecord> {
    this.assertNameFree(team.name);
    const record: RegisteredTeamRecord = {
      id: randomUUID(),
      captain_id: team.captainId,
      name: team.name.trim(),
      normalized_name: team.name.trim().toLowerCase(),
      description: team.description.trim() || null,
      badge: team.badge,
      badge_color: team.color,
      expected_members: team.expectedMembers,
      home_pub: null,
      created_at: new Date().toISOString(),
    };
    this.rows.set(record.id, record);
    return record;
  }

  async update(id: string, patch: RegisteredTeamPatch): Promise<RegisteredTeamRecord> {
    if (patch.name !== undefined) this.assertNameFree(patch.name, id);
    const existing = this.rows.get(id)!;
    const updated = { ...existing, ...patch };
    updated.normalized_name = updated.name.trim().toLowerCase();
    this.rows.set(id, updated);
    return updated;
  }

  async listPlayers(teamId: string): Promise<RegisteredTeamPlayerRecord[]> {
    return (this.players.get(teamId) ?? []).map(({ id, name, created_at }) => ({ id, name, created_at }));
  }

  async addPlayer(teamId: string, captainId: string, name: string): Promise<RegisteredTeamPlayerRecord> {
    if (this.rows.get(teamId)?.captain_id !== captainId) throw new ForbiddenException({ code: 'NOT_CAPTAIN' });
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) throw new BadRequestException({ code: 'INVALID_PLAYER' });
    const roster = this.players.get(teamId) ?? [];
    if (roster.length >= MAX_ROSTER) throw new BadRequestException({ code: 'ROSTER_FULL' });
    this.assertPlayerFree(teamId, trimmed);
    const player = { id: randomUUID(), team_id: teamId, name: trimmed, created_at: new Date().toISOString() };
    this.players.set(teamId, [...roster, player]);
    return { id: player.id, name: player.name, created_at: player.created_at };
  }

  async renamePlayer(teamId: string, playerId: string, name: string): Promise<RegisteredTeamPlayerRecord | null> {
    const player = (this.players.get(teamId) ?? []).find((p) => p.id === playerId);
    if (!player) return null;
    this.assertPlayerFree(teamId, name, playerId);
    player.name = name;
    return { id: player.id, name: player.name, created_at: player.created_at };
  }

  async removePlayer(teamId: string, playerId: string): Promise<boolean> {
    const roster = this.players.get(teamId) ?? [];
    const remaining = roster.filter((p) => p.id !== playerId);
    this.players.set(teamId, remaining);
    return remaining.length !== roster.length;
  }
}

/**
 * `teamPubs` and `playedAt` stand in for `registered_team_pubs` and finished nights, which
 * `teamsOfPubs` reads in the real repository; tests fill them.
 */
export class InMemoryLeaguesRepository extends LeaguesRepository {
  readonly rows = new Map<string, LeagueRecord>();
  readonly hostRows: LeagueHostRecord[] = [];
  readonly pubRows: LeaguePubRecord[] = [];
  readonly teamRows: LeagueTeamRecord[] = [];
  readonly resultRows: LeagueResultRecord[] = [];
  readonly teamPubs = new Map<string, { pubIds: string[]; primary: string | null }>();
  readonly playedAt = new Map<string, string[]>();

  async create(league: NewLeague): Promise<LeagueRecord> {
    const record: LeagueRecord = { ...league, id: randomUUID(), closed_at: null, created_at: new Date().toISOString() };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<LeagueRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: LeaguePatch): Promise<LeagueRecord> {
    const updated = { ...this.rows.get(id)!, ...patch };
    this.rows.set(id, updated);
    return updated;
  }

  async findSuperLeagueOf(parentId: string): Promise<LeagueRecord | null> {
    return [...this.rows.values()].find((row) => row.parent_league_id === parentId) ?? null;
  }

  async listForHost(hostId: string): Promise<LeagueRecord[]> {
    const ids = new Set(this.hostRows.filter((row) => row.host_id === hostId).map((row) => row.league_id));
    return [...this.rows.values()].filter((row) => ids.has(row.id));
  }

  async listForTeam(registeredTeamId: string): Promise<LeagueRecord[]> {
    const ids = new Set(this.teamRows.filter((row) => row.registered_team_id === registeredTeamId).map((row) => row.league_id));
    return [...this.rows.values()].filter((row) => ids.has(row.id));
  }

  async hosts(leagueId: string): Promise<LeagueHostRecord[]> {
    return this.hostRows.filter((row) => row.league_id === leagueId);
  }

  async setHost(leagueId: string, hostId: string, status: LeagueHostStatus): Promise<void> {
    const existing = this.hostRows.find((row) => row.league_id === leagueId && row.host_id === hostId);
    if (existing) existing.status = status;
    else this.hostRows.push({ league_id: leagueId, host_id: hostId, status });
  }

  async pubs(leagueId: string): Promise<LeaguePubRecord[]> {
    return this.pubRows.filter((row) => row.league_id === leagueId);
  }

  async addPubs(leagueId: string, hostId: string, pubIds: string[]): Promise<void> {
    for (const pubId of pubIds) {
      if (!this.pubRows.some((row) => row.league_id === leagueId && row.pub_id === pubId)) {
        this.pubRows.push({ league_id: leagueId, pub_id: pubId, host_id: hostId });
      }
    }
  }

  async teams(leagueId: string): Promise<LeagueTeamRecord[]> {
    return this.teamRows.filter((row) => row.league_id === leagueId);
  }

  async inviteTeams(leagueId: string, teams: { registeredTeamId: string; pubId: string | null }[]): Promise<void> {
    for (const team of teams) {
      if (!this.teamRows.some((row) => row.league_id === leagueId && row.registered_team_id === team.registeredTeamId)) {
        this.teamRows.push({ league_id: leagueId, registered_team_id: team.registeredTeamId, status: 'INVITED', pub_id: team.pubId });
      }
    }
  }

  async setTeamStatus(leagueId: string, registeredTeamId: string, status: LeagueTeamStatus, pubId?: string | null): Promise<void> {
    const existing = this.teamRows.find((row) => row.league_id === leagueId && row.registered_team_id === registeredTeamId);
    if (existing) {
      existing.status = status;
      if (pubId !== undefined) existing.pub_id = pubId;
    } else {
      this.teamRows.push({ league_id: leagueId, registered_team_id: registeredTeamId, status, pub_id: pubId ?? null });
    }
  }

  async results(leagueId: string): Promise<LeagueResultRecord[]> {
    return this.resultRows.filter((row) => row.league_id === leagueId).sort((a, b) => a.rank - b.rank);
  }

  async saveResults(leagueId: string, rows: LeagueResultRecord[]): Promise<void> {
    for (let i = this.resultRows.length - 1; i >= 0; i--) if (this.resultRows[i].league_id === leagueId) this.resultRows.splice(i, 1);
    this.resultRows.push(...rows);
  }

  async teamsOfPubs(pubIds: string[]): Promise<PubTeam[]> {
    const ids = new Set<string>();
    for (const [teamId, entry] of this.teamPubs) if (entry.pubIds.some((id) => pubIds.includes(id))) ids.add(teamId);
    for (const [teamId, pubs] of this.playedAt) if (pubs.some((id) => pubIds.includes(id))) ids.add(teamId);
    return [...ids].map((id) => ({ registeredTeamId: id, primaryPubId: this.teamPubs.get(id)?.primary ?? null }));
  }
}
