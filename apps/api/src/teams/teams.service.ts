import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionsRepository } from '../data/sessions.repository';
import { TeamsRepository } from '../data/teams.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { hashToken } from './hash-token';
import { TeamTokenService } from './team-token.service';

export interface JoinResult {
  teamId: string;
  name: string;
  token: string;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly teams: TeamsRepository,
    private readonly teamTokens: TeamTokenService,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  /**
   * Joins (or rejoins) a session. `registeredTeamId` is set only when a captain joins as their
   * registered team; that links the session team to it, and from then on nobody else can take
   * the name in this session.
   */
  /** "We're ready" from the lock-in screen; only accepted while a question is locked in. */
  async markReady(sessionId: string, teamId: string, fullscreen: boolean): Promise<{ ready: true }> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'LOCK_IN_ROUND' || !session.current_question_id) {
      throw new ConflictException({ code: 'NOT_LOCK_IN', message: 'No question is locked in right now' });
    }
    await this.teams.markReady(teamId, session.current_question_id, fullscreen);
    await this.broadcast.publish(sessionId, 'STATE_CHANGE', { teamId, ready: true });
    return { ready: true };
  }

  /**
   * A one-off team registers before the quiz starts: its session team (same seat, same token) is
   * linked to the registered team and takes its name. Closed once the first question has started.
   */
  async claim(
    sessionId: string,
    teamId: string,
    registeredTeamId: string,
    name: string,
    captainId: string,
  ): Promise<{ teamId: string; name: string }> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    // Same rule as joining: a host's team cannot play the host's own quiz night.
    if (session.host_id === captainId) {
      throw new ForbiddenException({ code: 'OWN_QUIZ', message: 'A host cannot play their own quiz night' });
    }
    if (session.status !== 'LOBBY') {
      throw new ConflictException({ code: 'REGISTRATION_CLOSED', message: 'Registration closes when the first question starts' });
    }
    const linked = await this.teams.findBySessionAndRegisteredTeam(sessionId, registeredTeamId);
    if (linked && linked.id !== teamId) {
      throw new ConflictException({ code: 'ALREADY_IN_SESSION', message: 'This team already plays in this quiz night' });
    }
    const sameName = await this.teams.findBySessionAndName(sessionId, name);
    if (sameName && sameName.id !== teamId) {
      throw new ConflictException({ code: 'TEAM_NAME_RESERVED', message: 'Another team in this quiz night uses this name' });
    }
    const team = await this.teams.linkRegistered(teamId, registeredTeamId, name);
    await this.broadcast.publish(sessionId, 'STATE_CHANGE', { teamId: team.id });
    return { teamId: team.id, name: team.name };
  }

  async join(
    sessionId: string,
    rawName: string,
    registeredTeamId: string | null = null,
    captainId: string | null = null,
    rawTableNumber: string | null = null,
    attendanceMode?: 'IN_PERSON' | 'REMOTE',
  ): Promise<JoinResult> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    // A host may captain a team, but not in their own quiz nights.
    if (captainId && session.host_id === captainId) {
      throw new ForbiddenException({ code: 'OWN_QUIZ', message: 'A host cannot play their own quiz night' });
    }
    if (session.status === 'FINISHED') throw new BadRequestException('This quiz has finished');

    let name = rawName.trim();
    if (!name) throw new BadRequestException('Team name is required');

    if (registeredTeamId) {
      // A registered team renamed mid-session keeps its existing session team.
      const linked = await this.teams.findBySessionAndRegisteredTeam(sessionId, registeredTeamId);
      if (linked) name = linked.name;
    }
    const existing = await this.teams.findBySessionAndName(sessionId, name);
    if (existing?.registered_team_id && existing.registered_team_id !== registeredTeamId) {
      throw new ConflictException({ code: 'TEAM_NAME_RESERVED', message: 'A registered team plays under this name' });
    }

    const team = await this.teams.upsertJoin(sessionId, name, registeredTeamId, rawTableNumber?.trim() || null, attendanceMode);
    const token = this.teamTokens.sign({ sessionId, teamId: team.id });
    await this.teams.setDeviceTokenHash(team.id, hashToken(token));

    await this.broadcast.publish(sessionId, 'STATE_CHANGE', { teamId: team.id });

    return { teamId: team.id, name: team.name, token };
  }
}
