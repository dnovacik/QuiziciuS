import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InfractionType } from '@quizicius/shared-types';
import { InfractionRecord, InfractionsRepository } from '../data/infractions.repository';
import { SessionsRepository } from '../data/sessions.repository';

@Injectable()
export class InfractionsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly infractions: InfractionsRepository,
  ) {}

  async report(sessionId: string, teamId: string, type: InfractionType): Promise<InfractionRecord> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return this.infractions.create(sessionId, teamId, type);
  }

  async listForHost(sessionId: string, hostId: string): Promise<InfractionRecord[]> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.host_id !== hostId) throw new ForbiddenException('Not your session');
    return this.infractions.listBySession(sessionId);
  }
}
