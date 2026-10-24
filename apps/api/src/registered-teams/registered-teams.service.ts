import { randomBytes, randomInt } from 'node:crypto';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PubLeaderboardDto, TeamLeagueDto } from '@quizicius/shared-types';
import {
  RegisteredTeamPatch,
  RegisteredTeamPlayerRecord,
  RegisteredTeamRecord,
  RegisteredTeamsRepository,
} from '../data/registered-teams.repository';
import { LeaguesService } from '../leagues/leagues.service';
import { PubsService } from '../pubs/pubs.service';
import { TeamTokenService } from '../teams/team-token.service';
import { JoinResult, TeamsService } from '../teams/teams.service';
import { EditTeamDto, RegisterTeamDto } from './dto/registered-team.dto';

/** Wrong PINs allowed per team within the window before it is locked for a while. */
const PIN_ATTEMPTS = 10;
const PIN_WINDOW_MS = 15 * 60_000;

const newPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const newInviteToken = () => randomBytes(18).toString('base64url');

export interface TeamAccess {
  pin: string;
  inviteToken: string;
}

export interface InvitePreview {
  name: string;
  badge: string;
  badgeColor: string;
  rosterSize: number;
}

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
  /** Recent wrong PIN attempts per registered team. */
  private readonly pinAttempts = new Map<string, number[]>();

  constructor(
    private readonly teams: RegisteredTeamsRepository,
    private readonly pubs: PubsService,
    private readonly sessionTeams: TeamsService,
    private readonly leaguesService: LeaguesService,
    private readonly teamTokens: TeamTokenService,
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

  /** The team's PIN and invite link secret, created the first time the captain needs them. */
  async access(captainId: string, teamId: string): Promise<TeamAccess> {
    let team = await this.own(teamId, captainId);
    if (!team.access_pin || !team.invite_token) {
      team = await this.teams.update(teamId, {
        access_pin: team.access_pin ?? newPin(),
        invite_token: team.invite_token ?? newInviteToken(),
      });
    }
    return { pin: team.access_pin!, inviteToken: team.invite_token! };
  }

  /** A new PIN or invite link; the old one stops working at once. */
  async rotateAccess(captainId: string, teamId: string, what: 'pin' | 'invite'): Promise<TeamAccess> {
    await this.access(captainId, teamId);
    const team = await this.teams.update(teamId, what === 'pin' ? { access_pin: newPin() } : { invite_token: newInviteToken() });
    return { pin: team.access_pin!, inviteToken: team.invite_token! };
  }

  /** What an invite link shows before a teammate adds their name. */
  async invitePreview(token: string): Promise<InvitePreview> {
    const team = await this.byInvite(token);
    const roster = await this.teams.listPlayers(team.id);
    return { name: team.name, badge: team.badge, badgeColor: team.badge_color, rosterSize: roster.length };
  }

  /** A teammate puts their name on the roster through the captain's invite link. */
  async joinRosterByInvite(token: string, name: string): Promise<RegisteredTeamPlayerRecord> {
    const team = await this.byInvite(token);
    return this.teams.addPlayer(team.id, team.captain_id, name);
  }

  /**
   * A teammate's phone joins a quiz night as the registered team with the team PIN, e.g. when the
   * captain is not there. Wrong PINs are counted per team, so the 6 digits cannot be guessed.
   */
  async joinSessionWithPin(sessionId: string, name: string, pin: string, tableNumber: string | null): Promise<JoinResult> {
    const team = await this.teams.findByName(name);
    if (!team) throw new NotFoundException({ code: 'TEAM_NOT_REGISTERED', message: 'No registered team has this name' });
    const now = Date.now();
    const attempts = (this.pinAttempts.get(team.id) ?? []).filter((at) => now - at < PIN_WINDOW_MS);
    if (attempts.length >= PIN_ATTEMPTS) {
      throw new HttpException({ code: 'TOO_MANY_ATTEMPTS', message: 'Too many wrong PINs, try again later' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!team.access_pin || team.access_pin !== pin) {
      this.pinAttempts.set(team.id, [...attempts, now]);
      throw new ForbiddenException({ code: 'WRONG_PIN', message: 'Wrong team PIN' });
    }
    this.pinAttempts.delete(team.id);
    return this.sessionTeams.join(sessionId, team.name, team.id, null, tableNumber);
  }

  private async byInvite(token: string): Promise<RegisteredTeamRecord> {
    const team = await this.teams.findByInviteToken(token);
    if (!team) throw new NotFoundException({ code: 'INVITE_NOT_FOUND', message: 'This invite link is not valid' });
    return team;
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

  /** The team's league invitations and leagues, with standings. */
  /** The leaderboard of a pub, for the captains' area. */
  pubLeaderboard(pubId: string, period: 'year' | 'all'): Promise<PubLeaderboardDto> {
    return this.leaguesService.pubLeaderboard(pubId, period);
  }

  async leagues(captainId: string, teamId: string): Promise<TeamLeagueDto[]> {
    await this.own(teamId, captainId);
    return this.leaguesService.forTeam(teamId);
  }

  async respondToLeague(captainId: string, teamId: string, leagueId: string, join: boolean): Promise<TeamLeagueDto> {
    await this.own(teamId, captainId);
    return this.leaguesService.respondAsTeam(teamId, leagueId, join);
  }

  /** Registers the phone's one-off team (identified by its team token) as this team, before the quiz starts. */
  async claimSeat(captainId: string, teamId: string, sessionId: string, teamToken: string): Promise<JoinResult> {
    const team = await this.own(teamId, captainId);
    let seat: { sessionId: string; teamId: string };
    try {
      seat = this.teamTokens.verify(teamToken);
    } catch {
      throw new ForbiddenException({ code: 'INVALID_TEAM_TOKEN', message: 'Invalid team token' });
    }
    if (seat.sessionId !== sessionId)
      throw new ForbiddenException({ code: 'INVALID_TEAM_TOKEN', message: 'Token does not match this session' });
    const claimed = await this.sessionTeams.claim(sessionId, seat.teamId, team.id, team.name, captainId);
    return { ...claimed, token: teamToken };
  }
}
