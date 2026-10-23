import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PubRecord, PubsRepository, TeamPubRecord } from '../data/pubs.repository';
import { AddPubDto } from './dto/add-pub.dto';

export const MAX_TEAM_PUBS = 5;

@Injectable()
export class PubsService {
  constructor(private readonly pubs: PubsRepository) {}

  search(query: string | null): Promise<PubRecord[]> {
    return this.pubs.search(query);
  }

  listForHost(hostId: string): Promise<PubRecord[]> {
    return this.pubs.listForHost(hostId);
  }

  /**
   * Adds a pub to the host's venue list. Pubs are shared, so a pub another host already
   * created (same name and city) is reused instead of duplicated.
   */
  async addForHost(hostId: string, dto: AddPubDto): Promise<PubRecord> {
    const name = dto.name.trim();
    const city = dto.city.trim();
    if (name.length < 2 || city.length < 2) throw new BadRequestException({ code: 'INVALID_PUB' });
    const pub =
      (await this.pubs.findByKey(name, city)) ?? (await this.pubs.create({ name, city, address: dto.address?.trim() || null }, hostId));
    await this.pubs.linkHost(hostId, pub.id);
    return pub;
  }

  /** Links an existing pub (picked from the shared list) to the host. */
  async linkForHost(hostId: string, pubId: string): Promise<PubRecord> {
    const pub = await this.requirePub(pubId);
    await this.pubs.linkHost(hostId, pub.id);
    return pub;
  }

  unlinkForHost(hostId: string, pubId: string): Promise<void> {
    return this.pubs.unlinkHost(hostId, pubId);
  }

  async requirePub(pubId: string): Promise<PubRecord> {
    const pub = await this.pubs.findById(pubId);
    if (!pub) throw new NotFoundException({ code: 'PUB_NOT_FOUND', message: 'Pub not found' });
    return pub;
  }

  listForTeam(teamId: string): Promise<TeamPubRecord[]> {
    return this.pubs.listForTeam(teamId);
  }

  /** Sets a registered team's pubs; the primary pub defaults to the first one. */
  async setTeamPubs(teamId: string, pubIds: string[], primaryPubId: string | null | undefined): Promise<void> {
    const unique = [...new Set(pubIds)];
    if (unique.length > MAX_TEAM_PUBS) throw new BadRequestException({ code: 'TOO_MANY_PUBS' });
    await Promise.all(unique.map((id) => this.requirePub(id)));
    const primary = unique.length === 0 ? null : primaryPubId && unique.includes(primaryPubId) ? primaryPubId : unique[0];
    await this.pubs.setTeamPubs(teamId, unique, primary);
  }
}
