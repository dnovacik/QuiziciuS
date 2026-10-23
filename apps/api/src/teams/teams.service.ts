import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async join(sessionId: string, rawName: string, registeredTeamId: string | null = null): Promise<JoinResult> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
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

    const team = await this.teams.upsertJoin(sessionId, name, registeredTeamId);
    const token = this.teamTokens.sign({ sessionId, teamId: team.id });
    await this.teams.setDeviceTokenHash(team.id, hashToken(token));

    await this.broadcast.publish(sessionId, 'STATE_CHANGE', { teamId: team.id });

    return { teamId: team.id, name: team.name, token };
  }
}
