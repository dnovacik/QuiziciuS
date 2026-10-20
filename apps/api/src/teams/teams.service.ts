import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionsRepository } from '../data/sessions.repository';
import { TeamsRepository } from '../data/teams.repository';
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
  ) {}

  async join(sessionId: string, rawName: string): Promise<JoinResult> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'FINISHED') throw new BadRequestException('This quiz has finished');

    const name = rawName.trim();
    if (!name) throw new BadRequestException('Team name is required');

    const team = await this.teams.upsertJoin(sessionId, name);
    const token = this.teamTokens.sign({ sessionId, teamId: team.id });
    await this.teams.setDeviceTokenHash(team.id, hashToken(token));

    return { teamId: team.id, name: team.name, token };
  }
}
