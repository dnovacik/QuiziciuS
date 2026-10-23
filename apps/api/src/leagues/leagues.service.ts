import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  HostLeagueDto,
  InvitableHostDto,
  LeagueDetailDto,
  LeagueHostStatus,
  LeaguePhase,
  LeagueStandingDto,
  LeagueSummaryDto,
  LeagueTeamStatus,
  TeamLeagueDto,
} from '@quizicius/shared-types';
import { today } from '../accounts/subscription';
import { LeagueHostRecord, LeagueRecord, LeaguesRepository, LeagueTeamRecord } from '../data/leagues.repository';
import { ProfilesRepository } from '../data/profiles.repository';
import { PubsRepository } from '../data/pubs.repository';
import { RegisteredTeamsRepository } from '../data/registered-teams.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { CreateLeagueDto, UpdateLeagueDto } from './dto/league.dto';
import { leagueStandings, LeagueMember, NightResult, qualifiers, superLeagueStandings } from './standings';

const LEAGUE_NOT_FOUND = () => new NotFoundException({ code: 'LEAGUE_NOT_FOUND', message: 'League not found' });
const NOT_LEAGUE_OWNER = () => new ForbiddenException({ code: 'NOT_LEAGUE_OWNER', message: 'Only the league owner can do this' });
const LEAGUE_CLOSED = () => new ConflictException({ code: 'LEAGUE_CLOSED', message: 'The league is closed' });
const PUB_NOT_IN_LEAGUE = () => new BadRequestException({ code: 'PUB_NOT_IN_LEAGUE', message: 'The pub is not part of this league' });

/**
 * Leagues: proposals, co-hosts, invitations, standings, closing and Super Leagues.
 * Standings are computed from the finished nights ticked for the league until it closes, then
 * read from the frozen `league_results`. Teams that played a night are made members whenever the
 * league is read, so nothing in the quiz engine needs to know about leagues.
 */
@Injectable()
export class LeaguesService {
  constructor(
    private readonly leagues: LeaguesRepository,
    private readonly sessions: SessionsRepository,
    private readonly pubs: PubsRepository,
    private readonly profiles: ProfilesRepository,
    private readonly teams: RegisteredTeamsRepository,
    private readonly engine: QuizEngineService,
  ) {}

  // ---------- reading ----------

  private phase(league: LeagueRecord): LeaguePhase {
    if (league.closed_at) return 'CLOSED';
    return league.starts_on > today() ? 'PREPARING' : 'RUNNING';
  }

  private async requireLeague(leagueId: string): Promise<LeagueRecord> {
    const league = await this.leagues.findById(leagueId);
    if (!league) throw LEAGUE_NOT_FOUND();
    return league;
  }

  /** The league and the caller's host row; hosts with no row get LEAGUE_NOT_FOUND. */
  private async requireHostOf(hostId: string, leagueId: string): Promise<{ league: LeagueRecord; mine: LeagueHostRecord }> {
    const league = await this.requireLeague(leagueId);
    const mine = (await this.leagues.hosts(leagueId)).find((row) => row.host_id === hostId);
    if (!mine) throw LEAGUE_NOT_FOUND();
    return { league, mine };
  }

  private async requireOwner(hostId: string, leagueId: string): Promise<LeagueRecord> {
    const { league } = await this.requireHostOf(hostId, leagueId);
    if (league.owner_host_id !== hostId) throw NOT_LEAGUE_OWNER();
    return league;
  }

  private async hostName(hostId: string): Promise<string> {
    const profile = await this.profiles.findById(hostId);
    return profile?.display_name ?? profile?.email ?? '—';
  }

  private async teamName(teamId: string): Promise<string> {
    return (await this.teams.findById(teamId))?.name ?? '—';
  }

  /** Final scores of every finished night ticked for the league. */
  async nights(league: LeagueRecord): Promise<NightResult[]> {
    const finished = (await this.sessions.listByLeague(league.id)).filter((session) => session.status === 'FINISHED');
    return Promise.all(
      finished.map(async (session) => {
        const state = await this.engine.getState(session.id);
        return {
          sessionId: session.id,
          finishedAt: session.finished_at ?? session.created_at,
          pubId: session.pub_id,
          teams: state.teams.map((team) => ({ registeredTeamId: team.registeredTeamId, score: team.score })),
        };
      }),
    );
  }

  /** The pub a joining team represents: its primary pub if that is a league pub, else `fallback`. */
  private async pubSnapshot(teamId: string, leaguePubIds: string[], fallback: string | null): Promise<string | null> {
    const primary = (await this.pubs.listForTeam(teamId)).find((pub) => pub.is_primary)?.id ?? null;
    return primary && leaguePubIds.includes(primary) ? primary : fallback;
  }

  /**
   * Playing is joining: registered teams that played a night become members. A Super League only
   * has the teams that qualified, so there it promotes existing rows and adds nobody.
   */
  async syncPlayed(league: LeagueRecord, nights: NightResult[]): Promise<void> {
    const rows = new Map((await this.leagues.teams(league.id)).map((row) => [row.registered_team_id, row]));
    const leaguePubIds = (await this.leagues.pubs(league.id)).map((row) => row.pub_id);
    const firstNightPub = new Map<string, string | null>();
    for (const night of [...nights].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))) {
      for (const team of night.teams) {
        if (team.registeredTeamId && !firstNightPub.has(team.registeredTeamId)) firstNightPub.set(team.registeredTeamId, night.pubId);
      }
    }
    for (const [teamId, nightPub] of firstNightPub) {
      const row = rows.get(teamId);
      if (row?.status === 'JOINED') continue;
      if (!row && league.kind === 'SUPER') continue;
      const pubId = row?.pub_id ?? (await this.pubSnapshot(teamId, leaguePubIds, nightPub));
      await this.leagues.setTeamStatus(league.id, teamId, 'JOINED', pubId);
    }
  }

  private async liveStandings(league: LeagueRecord): Promise<{ standings: LeagueStandingDto[]; nightsPlayed: number }> {
    const nights = await this.nights(league);
    await this.syncPlayed(league, nights);
    const members: LeagueMember[] = await Promise.all(
      (await this.leagues.teams(league.id))
        .filter((row) => row.status === 'JOINED')
        .map(async (row) => ({
          registeredTeamId: row.registered_team_id,
          teamName: await this.teamName(row.registered_team_id),
          pubId: row.pub_id,
        })),
    );
    const standings = league.kind === 'SUPER' ? superLeagueStandings(nights, members) : leagueStandings(nights, members);
    return { standings, nightsPlayed: nights.length };
  }

  /** Frozen once closed; live from the nights until then. */
  private async standings(league: LeagueRecord): Promise<{ standings: LeagueStandingDto[]; nightsPlayed: number }> {
    if (!league.closed_at) return this.liveStandings(league);
    const results = await this.leagues.results(league.id);
    const nightsPlayed = (await this.sessions.listByLeague(league.id)).filter((s) => s.status === 'FINISHED').length;
    return {
      nightsPlayed,
      standings: results.map((row) => ({
        rank: row.rank,
        registeredTeamId: row.registered_team_id ?? '',
        teamName: row.team_name,
        pubId: row.pub_id,
        points: row.points,
        nights: row.nights,
        placements: row.placements,
      })),
    };
  }

  private async summary(
    league: LeagueRecord,
    computed?: { standings: LeagueStandingDto[]; nightsPlayed: number },
  ): Promise<LeagueSummaryDto> {
    const [pubRows, teamRows, ownerName] = await Promise.all([
      this.leagues.pubs(league.id),
      this.leagues.teams(league.id),
      this.hostName(league.owner_host_id),
    ]);
    const pubs = await Promise.all(
      pubRows.map(async (row) => {
        const pub = await this.pubs.findById(row.pub_id);
        return { id: row.pub_id, name: pub?.name ?? '—', city: pub?.city ?? '', hostId: row.host_id };
      }),
    );
    const nightsPlayed =
      computed?.nightsPlayed ?? (await this.sessions.listByLeague(league.id)).filter((s) => s.status === 'FINISHED').length;
    return {
      id: league.id,
      name: league.name,
      kind: league.kind,
      phase: this.phase(league),
      startsOn: league.starts_on,
      endsOn: league.ends_on,
      message: league.message,
      ownerHostId: league.owner_host_id,
      ownerName,
      pubs,
      nightsPlayed,
      joinedTeams: teamRows.filter((row) => row.status === 'JOINED').length,
      parentLeagueId: league.parent_league_id,
    };
  }

  private async hostView(league: LeagueRecord, hostId: string, myStatus: LeagueHostStatus): Promise<HostLeagueDto> {
    return { ...(await this.summary(league)), myStatus, isOwner: league.owner_host_id === hostId };
  }

  async list(hostId: string): Promise<HostLeagueDto[]> {
    const leagues = await this.leagues.listForHost(hostId);
    return Promise.all(
      leagues.map(async (league) => {
        const mine = (await this.leagues.hosts(league.id)).find((row) => row.host_id === hostId)!;
        return this.hostView(league, hostId, mine.status);
      }),
    );
  }

  async detail(hostId: string, leagueId: string): Promise<LeagueDetailDto> {
    const { league, mine } = await this.requireHostOf(hostId, leagueId);
    const computed = await this.standings(league);
    const [summary, hostRows, teamRows, superLeague] = await Promise.all([
      this.summary(league, computed),
      this.leagues.hosts(league.id),
      this.leagues.teams(league.id),
      this.leagues.findSuperLeagueOf(league.id),
    ]);
    const isOwner = league.owner_host_id === hostId;
    return {
      ...summary,
      myStatus: mine.status,
      isOwner,
      hosts: await Promise.all(
        hostRows.map(async (row) => ({ id: row.host_id, name: await this.hostName(row.host_id), status: row.status })),
      ),
      teams: await Promise.all(
        teamRows.map(async (row) => ({
          registeredTeamId: row.registered_team_id,
          name: await this.teamName(row.registered_team_id),
          status: row.status,
          pubId: row.pub_id,
        })),
      ),
      standings: computed.standings,
      qualified: league.closed_at && league.kind === 'LEAGUE' ? qualifiers(computed.standings) : [],
      superLeagueId: superLeague?.id ?? null,
      endedAwaitingClose: isOwner && !league.closed_at && league.ends_on !== null && league.ends_on < today(),
    };
  }

  // ---------- hosts ----------

  /** Invites the registered teams of `pubIds` (with a pub snapshot when their primary pub is in the league). */
  private async inviteTeamsOf(league: LeagueRecord, pubIds: string[]): Promise<void> {
    const leaguePubIds = (await this.leagues.pubs(league.id)).map((row) => row.pub_id);
    const teams = await this.leagues.teamsOfPubs(pubIds);
    await this.leagues.inviteTeams(
      league.id,
      teams.map((team) => ({
        registeredTeamId: team.registeredTeamId,
        pubId: team.primaryPubId && leaguePubIds.includes(team.primaryPubId) ? team.primaryPubId : null,
      })),
    );
  }

  private async requireOwnPubs(hostId: string, pubIds: string[]): Promise<string[]> {
    const own = new Set((await this.pubs.listForHost(hostId)).map((pub) => pub.id));
    const unique = [...new Set(pubIds)];
    if (!unique.length || unique.some((id) => !own.has(id))) throw PUB_NOT_IN_LEAGUE();
    return unique;
  }

  async create(hostId: string, dto: CreateLeagueDto): Promise<LeagueDetailDto> {
    const pubIds = await this.requireOwnPubs(hostId, dto.pubIds);
    const league = await this.leagues.create({
      name: dto.name.trim(),
      kind: 'LEAGUE',
      owner_host_id: hostId,
      starts_on: dto.startsOn,
      ends_on: dto.endsOn ?? null,
      message: dto.message?.trim() || null,
      parent_league_id: null,
    });
    await this.leagues.setHost(league.id, hostId, 'ACCEPTED');
    await this.leagues.addPubs(league.id, hostId, pubIds);
    for (const invited of new Set(dto.inviteHostIds ?? [])) {
      if (invited === hostId) continue;
      const profile = await this.profiles.findById(invited);
      if (profile && profile.role !== 'TEAM_CAPTAIN') await this.leagues.setHost(league.id, invited, 'INVITED');
    }
    await this.inviteTeamsOf(league, pubIds);
    return this.detail(hostId, league.id);
  }

  async update(hostId: string, leagueId: string, dto: UpdateLeagueDto): Promise<LeagueDetailDto> {
    const league = await this.requireOwner(hostId, leagueId);
    if (league.closed_at) throw LEAGUE_CLOSED();
    await this.leagues.update(leagueId, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.startsOn !== undefined && { starts_on: dto.startsOn }),
      ...(dto.endsOn !== undefined && { ends_on: dto.endsOn }),
      ...(dto.message !== undefined && { message: dto.message.trim() || null }),
    });
    return this.detail(hostId, leagueId);
  }

  /** An invited host accepts with their pubs (whose teams are then invited), or declines. */
  async respond(hostId: string, leagueId: string, accept: boolean, pubIds: string[]): Promise<LeagueDetailDto> {
    const { league, mine } = await this.requireHostOf(hostId, leagueId);
    if (league.closed_at) throw LEAGUE_CLOSED();
    if (mine.host_id === league.owner_host_id)
      throw new BadRequestException({ code: 'NOT_INVITED', message: 'The owner runs the league already' });
    if (!accept) {
      await this.leagues.setHost(leagueId, hostId, 'DECLINED');
      return this.detail(hostId, leagueId);
    }
    const own = await this.requireOwnPubs(hostId, pubIds);
    await this.leagues.setHost(leagueId, hostId, 'ACCEPTED');
    await this.leagues.addPubs(leagueId, hostId, own);
    await this.inviteTeamsOf(league, own);
    return this.detail(hostId, leagueId);
  }

  async invitableHosts(hostId: string): Promise<InvitableHostDto[]> {
    const hosts = await this.profiles.listByRoles(['SUPER_ADMIN', 'HOST']);
    return Promise.all(
      hosts
        .filter((host) => host.id !== hostId && !host.deactivated_at)
        .map(async (host) => ({
          id: host.id,
          name: host.display_name,
          pubs: (await this.pubs.listForHost(host.id)).map((pub) => ({ id: pub.id, name: pub.name, city: pub.city })),
        })),
    );
  }

  /** Freezes the standings into `league_results`. */
  async close(hostId: string, leagueId: string): Promise<LeagueDetailDto> {
    const league = await this.requireOwner(hostId, leagueId);
    if (league.closed_at) throw LEAGUE_CLOSED();
    const { standings } = await this.liveStandings(league);
    await this.leagues.saveResults(
      leagueId,
      standings.map((row) => ({
        league_id: leagueId,
        registered_team_id: row.registeredTeamId,
        team_name: row.teamName,
        pub_id: row.pubId,
        rank: row.rank,
        points: row.points,
        nights: row.nights,
        placements: row.placements,
      })),
    );
    await this.leagues.update(leagueId, { closed_at: new Date().toISOString() });
    return this.detail(hostId, leagueId);
  }

  /** The final of a closed league: its qualified teams, its co-hosts (asked again), the owner's pubs. */
  async createSuperLeague(hostId: string, leagueId: string): Promise<LeagueDetailDto> {
    const parent = await this.requireOwner(hostId, leagueId);
    if (parent.kind !== 'LEAGUE' || !parent.closed_at) {
      throw new ConflictException({ code: 'LEAGUE_NOT_CLOSED', message: 'Close the league first' });
    }
    if (await this.leagues.findSuperLeagueOf(leagueId)) {
      throw new ConflictException({ code: 'SUPER_LEAGUE_EXISTS', message: 'This league already has a Super League' });
    }
    const { standings } = await this.standings(parent);
    const superLeague = await this.leagues.create({
      name: `Super liga — ${parent.name}`,
      kind: 'SUPER',
      owner_host_id: hostId,
      starts_on: today(),
      ends_on: null,
      message: null,
      parent_league_id: leagueId,
    });
    await this.leagues.setHost(superLeague.id, hostId, 'ACCEPTED');
    for (const row of await this.leagues.hosts(leagueId)) {
      if (row.host_id !== hostId && row.status === 'ACCEPTED') await this.leagues.setHost(superLeague.id, row.host_id, 'INVITED');
    }
    const ownerPubs = (await this.leagues.pubs(leagueId)).filter((row) => row.host_id === hostId).map((row) => row.pub_id);
    await this.leagues.addPubs(superLeague.id, hostId, ownerPubs);
    await this.leagues.inviteTeams(
      superLeague.id,
      qualifiers(standings).map((row) => ({ registeredTeamId: row.registeredTeamId, pubId: row.pubId })),
    );
    return this.detail(hostId, superLeague.id);
  }

  /** Called before launching a night ticked for `leagueId` at `pubId`. */
  async assertCanLaunch(hostId: string, leagueId: string, pubId: string | null): Promise<void> {
    const league = await this.requireLeague(leagueId);
    const mine = (await this.leagues.hosts(leagueId)).find((row) => row.host_id === hostId);
    if (mine?.status !== 'ACCEPTED') throw new ForbiddenException({ code: 'NOT_LEAGUE_HOST', message: 'You do not run this league' });
    if (league.closed_at) throw LEAGUE_CLOSED();
    const runsPub = (await this.leagues.pubs(leagueId)).some((row) => row.pub_id === pubId && row.host_id === hostId);
    if (!pubId || !runsPub) throw PUB_NOT_IN_LEAGUE();
  }

  // ---------- teams ----------

  private async teamView(league: LeagueRecord, row: LeagueTeamRecord): Promise<TeamLeagueDto> {
    const computed = await this.standings(league);
    return { league: await this.summary(league, computed), status: row.status, standings: computed.standings };
  }

  /** The team's invitations and leagues; a league it played in shows as joined. */
  async forTeam(registeredTeamId: string): Promise<TeamLeagueDto[]> {
    const leagues = await this.leagues.listForTeam(registeredTeamId);
    const views: TeamLeagueDto[] = [];
    for (const league of leagues) {
      if (!league.closed_at) await this.syncPlayed(league, await this.nights(league));
      const row = (await this.leagues.teams(league.id)).find((r) => r.registered_team_id === registeredTeamId)!;
      views.push(await this.teamView(league, row));
    }
    return views;
  }

  async respondAsTeam(registeredTeamId: string, leagueId: string, join: boolean): Promise<TeamLeagueDto> {
    const league = await this.requireLeague(leagueId);
    const row = (await this.leagues.teams(leagueId)).find((r) => r.registered_team_id === registeredTeamId);
    if (!row) throw LEAGUE_NOT_FOUND();
    if (league.closed_at) throw LEAGUE_CLOSED();
    const status: LeagueTeamStatus = join ? 'JOINED' : 'DECLINED';
    const leaguePubIds = (await this.leagues.pubs(leagueId)).map((r) => r.pub_id);
    const pubId = join ? (row.pub_id ?? (await this.pubSnapshot(registeredTeamId, leaguePubIds, null))) : row.pub_id;
    await this.leagues.setTeamStatus(leagueId, registeredTeamId, status, pubId);
    return this.teamView(league, { ...row, status, pub_id: pubId });
  }
}
