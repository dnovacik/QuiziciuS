import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  RegisteredTeamPatch,
  RegisteredTeamPlayerRecord,
  RegisteredTeamRecord,
  RegisteredTeamsRepository,
} from '../data/registered-teams.repository';
import { PubsService } from '../pubs/pubs.service';
import { JoinResult, TeamsService } from '../teams/teams.service';
import { EditTeamDto, RegisterTeamDto } from './dto/registered-team.dto';

export interface TeamPub {
  id: string;
  name: string;
  city: string;
  isPrimary: boolean;
}

/** A registered team as the web app sees it: the row plus its pubs (primary first). */
export type RegisteredTeamView = RegisteredTeamRecord & { pubs: TeamPub[] };

export type NameAvailability = { available: boolean; code: 'INVALID_NAME' | 'NAME_TAKEN' | 'NAME_AVAILABLE' };

const TEAM_NOT_FOUND = () => new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
const PLAYER_NOT_FOUND = () => new NotFoundException({ code: 'PLAYER_NOT_FOUND', message: 'Player not found' });

function validName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 3 && name.length <= 30 ? name : null;
}

/**
 * Permanent teams managed by their captain. Every team action checks the caller captains the
 * team; another captain's team looks the same as a missing one (`TEAM_NOT_FOUND`).
 */
@Injectable()
export class RegisteredTeamsService {
  constructor(
    private readonly teams: RegisteredTeamsRepository,
    private readonly pubs: PubsService,
    private readonly sessionTeams: TeamsService,
  ) {}

  private async withPubs(team: RegisteredTeamRecord): Promise<RegisteredTeamView> {
    const pubs = await this.pubs.listForTeam(team.id);
    return { ...team, pubs: pubs.map((pub) => ({ id: pub.id, name: pub.name, city: pub.city, isPrimary: pub.is_primary })) };
  }

  private async own(teamId: string, captainId: string): Promise<RegisteredTeamRecord> {
    const team = await this.teams.findById(teamId);
    if (!team || team.captain_id !== captainId) throw TEAM_NOT_FOUND();
    return team;
  }

  async mine(captainId: string): Promise<RegisteredTeamView[]> {
    const teams = await this.teams.listByCaptain(captainId);
    return Promise.all(teams.map((team) => this.withPubs(team)));
  }

  async availability(rawName: string): Promise<NameAvailability> {
    const name = validName(rawName);
    if (!name) return { available: false, code: 'INVALID_NAME' };
    const taken = await this.teams.isNameTaken(name);
    return { available: !taken, code: taken ? 'NAME_TAKEN' : 'NAME_AVAILABLE' };
  }

  async create(captainId: string, dto: RegisterTeamDto): Promise<RegisteredTeamView> {
    const name = validName(dto.name);
    if (!name) throw new BadRequestException({ code: 'INVALID_NAME', message: 'Invalid team name' });
    const team = await this.teams.create({
      captainId,
      name,
      description: dto.description ?? '',
      badge: dto.badge ?? 'shield',
      color: dto.color ?? 'purple',
      expectedMembers: dto.expectedMembers,
    });
    if (dto.pubIds?.length) await this.pubs.setTeamPubs(team.id, dto.pubIds, dto.primaryPubId);
    return this.withPubs(team);
  }

  async update(captainId: string, teamId: string, dto: EditTeamDto): Promise<RegisteredTeamView> {
    let team = await this.own(teamId, captainId);
    const patch: RegisteredTeamPatch = {};
    if (dto.name !== undefined) {
      const name = validName(dto.name);
      if (!name) throw new BadRequestException({ code: 'INVALID_NAME', message: 'Invalid team name' });
      patch.name = name;
    }
    if (dto.description !== undefined) patch.description = dto.description.trim() || null;
    if (dto.badge !== undefined) patch.badge = dto.badge;
    if (dto.color !== undefined) patch.badge_color = dto.color;
    if (dto.expectedMembers !== undefined) patch.expected_members = dto.expectedMembers;
    const pubsChanged = dto.pubIds !== undefined;
    if (!Object.keys(patch).length && !pubsChanged) throw new BadRequestException({ code: 'NO_CHANGES', message: 'Nothing to change' });

    if (pubsChanged) await this.pubs.setTeamPubs(teamId, dto.pubIds ?? [], dto.primaryPubId);
    if (Object.keys(patch).length) team = await this.teams.update(teamId, patch);
    return this.withPubs(team);
  }

  /** The captain joins a live session as the registered team, which links the session team to it. */
  async joinSession(captainId: string, teamId: string, sessionId: string): Promise<JoinResult> {
    const team = await this.own(teamId, captainId);
    return this.sessionTeams.join(sessionId, team.name, team.id, captainId);
  }

  async players(captainId: string, teamId: string): Promise<RegisteredTeamPlayerRecord[]> {
    await this.own(teamId, captainId);
    return this.teams.listPlayers(teamId);
  }

  async addPlayer(captainId: string, teamId: string, name: string): Promise<RegisteredTeamPlayerRecord> {
    await this.own(teamId, captainId);
    return this.teams.addPlayer(teamId, captainId, name);
  }

  async renamePlayer(captainId: string, teamId: string, playerId: string, rawName: string): Promise<RegisteredTeamPlayerRecord> {
    await this.own(teamId, captainId);
    const name = rawName.trim();
    if (!name) throw new BadRequestException({ code: 'INVALID_PLAYER', message: 'Invalid player name' });
    const player = await this.teams.renamePlayer(teamId, playerId, name);
    if (!player) throw PLAYER_NOT_FOUND();
    return player;
  }

  async removePlayer(captainId: string, teamId: string, playerId: string): Promise<{ deleted: true }> {
    await this.own(teamId, captainId);
    if (!(await this.teams.removePlayer(teamId, playerId))) throw PLAYER_NOT_FOUND();
    return { deleted: true };
  }
}
