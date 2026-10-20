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

  /**
   * The host-facing review queue: already-reviewed infractions are filtered out so
   * that dismissing one actually drains the list. The raw `listBySession` feed is
   * left untouched for `QuizEngineService.getState`, which still counts every
   * infraction a team incurred, reviewed or not.
   */
  async listForHost(sessionId: string, hostId: string): Promise<InfractionRecord[]> {
    await this.requireOwnedSession(sessionId, hostId);
    const rows = await this.infractions.listBySession(sessionId);
    return rows.filter((row) => !row.reviewed);
  }

  async markReviewed(sessionId: string, infractionId: string, hostId: string): Promise<InfractionRecord> {
    await this.requireOwnedSession(sessionId, hostId);
    const infraction = await this.infractions.findById(infractionId);
    if (!infraction || infraction.session_id !== sessionId) {
      throw new NotFoundException('Infraction not found');
    }
    return this.infractions.markReviewed(infractionId);
  }

  private async requireOwnedSession(sessionId: string, hostId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.host_id !== hostId) throw new ForbiddenException('Not your session');
  }
}
