import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  HostLeagueDto,
  InvitableHostDto,
  LeagueDetailDto,
  LeagueHostStatus,
  LeagueKind,
  LeaguePhase,
  LeagueStandingDto,
  LeagueSummaryDto,
  LeagueTeamStatus,
  PubLeaderboardDto,
  TeamLeagueDto,
} from '@quizicius/shared-types';
import { today } from '../accounts/subscription';
import { LeagueHostRecord, LeaguePubRecord, LeagueRecord, LeaguesRepository, LeagueTeamRecord } from '../data/leagues.repository';
import { ProfilesRepository } from '../data/profiles.repository';
import { PubsRepository } from '../data/pubs.repository';
import { RegisteredTeamsRepository } from '../data/registered-teams.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { TeamsRepository } from '../data/teams.repository';
import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { CreateLeagueDto, UpdateLeagueDto } from './dto/league.dto';
import { leagueStandings, LeagueMember, NightResult, qualifiers, superLeagueStandings } from './standings';

const LEAGUE_NOT_FOUND = () => new NotFoundException({ code: 'LEAGUE_NOT_FOUND', message: 'League not found' });
const NOT_LEAGUE_OWNER = () => new ForbiddenException({ code: 'NOT_LEAGUE_OWNER', message: 'Only the league owner can do this' });
const LEAGUE_CLOSED = () => new ConflictException({ code: 'LEAGUE_CLOSED', message: 'The league is closed' });
/** A league with everything its pages read: hosts, pubs, team rows and finished nights. */
interface LeagueData {
  league: LeagueRecord;
  hosts: LeagueHostRecord[];
  pubs: LeaguePubRecord[];
  teams: LeagueTeamRecord[];
  finished: SessionRecord[];
}

/** A league table plus the team rows it was computed from (after "playing is joining") and team names. */
interface Computed {
  standings: LeagueStandingDto[];
  teams: LeagueTeamRecord[];
  names: Map<string, string>;
}

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
    private readonly sessionTeams: TeamsRepository,
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

  /** The league, its hosts and the caller's host row; hosts with no row get LEAGUE_NOT_FOUND. */
  private async requireHostOf(
    hostId: string,
    leagueId: string,
  ): Promise<{ league: LeagueRecord; hosts: LeagueHostRecord[]; mine: LeagueHostRecord }> {
    const [league, hosts] = await Promise.all([this.leagues.findById(leagueId), this.leagues.hosts(leagueId)]);
    const mine = hosts.find((row) => row.host_id === hostId);
    if (!league || !mine) throw LEAGUE_NOT_FOUND();
    return { league, hosts, mine };
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

  private async teamNames(teamIds: string[]): Promise<Map<string, string>> {
    const entries = await Promise.all([...new Set(teamIds)].map(async (id) => [id, (await this.teams.findById(id))?.name ?? '—'] as const));
    return new Map(entries);
  }

  /** Everything a league's pages need, read once and in parallel. */
  private async loadData(league: LeagueRecord, hosts?: LeagueHostRecord[]): Promise<LeagueData> {
    const [hostRows, pubs, teams, sessions] = await Promise.all([
      hosts ?? this.leagues.hosts(league.id),
      this.leagues.pubs(league.id),
      this.leagues.teams(league.id),
      this.sessions.listByLeague(league.id),
    ]);
    return { league, hosts: hostRows, pubs, teams, finished: sessions.filter((session) => session.status === 'FINISHED') };
  }

  /** Final scores of every finished night ticked for the league. */
  private async nights(data: LeagueData): Promise<NightResult[]> {
    return Promise.all(
      data.finished.map(async (session) => {
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
   * Returns the league's team rows after the changes.
   */
  private async syncPlayed(data: LeagueData, nights: NightResult[]): Promise<LeagueTeamRecord[]> {
    const rows = new Map(data.teams.map((row) => [row.registered_team_id, row]));
    const leaguePubIds = data.pubs.map((row) => row.pub_id);
    const firstNightPub = new Map<string, string | null>();
    for (const night of [...nights].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))) {
      for (const team of night.teams) {
        if (team.registeredTeamId && !firstNightPub.has(team.registeredTeamId)) firstNightPub.set(team.registeredTeamId, night.pubId);
      }
    }
    const pending = [...firstNightPub].filter(([teamId]) => {
      const row = rows.get(teamId);
      // A member that joined from its invitation may still lack a pub; its first night supplies one.
      if (row?.status === 'JOINED' && row.pub_id) return false;
      return Boolean(row) || data.league.kind !== 'SUPER';
    });
    const joined = await Promise.all(
      pending.map(async ([teamId, nightPub]): Promise<LeagueTeamRecord> => {
        const pubId = rows.get(teamId)?.pub_id ?? (await this.pubSnapshot(teamId, leaguePubIds, nightPub));
        await this.leagues.setTeamStatus(data.league.id, teamId, 'JOINED', pubId);
        return { league_id: data.league.id, registered_team_id: teamId, status: 'JOINED', pub_id: pubId };
      }),
    );
    for (const row of joined) rows.set(row.registered_team_id, row);
    return [...rows.values()];
  }

  /** The table (live until closed, then frozen), the team rows after "playing is joining", and team names. */
  private async computeStandings(data: LeagueData): Promise<Computed> {
    const { league } = data;
    if (league.closed_at) {
      const [results, names] = await Promise.all([
        this.leagues.results(league.id),
        this.teamNames(data.teams.map((r) => r.registered_team_id)),
      ]);
      return {
        teams: data.teams,
        names,
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
    const [nights, names] = await Promise.all([this.nights(data), this.teamNames(data.teams.map((r) => r.registered_team_id))]);
    const teams = await this.syncPlayed(data, nights);
    const unnamed = teams.map((row) => row.registered_team_id).filter((id) => !names.has(id));
    if (unnamed.length) for (const [id, name] of await this.teamNames(unnamed)) names.set(id, name);
    const members: LeagueMember[] = teams
      .filter((row) => row.status === 'JOINED')
      .map((row) => ({ registeredTeamId: row.registered_team_id, teamName: names.get(row.registered_team_id) ?? '—', pubId: row.pub_id }));
    const standings = league.kind === 'SUPER' ? superLeagueStandings(nights, members) : leagueStandings(nights, members);
    return { teams, names, standings };
  }

  /** `teams` are the rows after "playing is joining" when the table was computed alongside. */
  private async summaryOf(data: LeagueData, teams: LeagueTeamRecord[] = data.teams): Promise<LeagueSummaryDto> {
    const { league } = data;
    const [ownerName, pubs] = await Promise.all([
      this.hostName(league.owner_host_id),
      Promise.all(
        data.pubs.map(async (row) => {
          const pub = await this.pubs.findById(row.pub_id);
          return { id: row.pub_id, name: pub?.name ?? '—', city: pub?.city ?? '', hostId: row.host_id };
        }),
      ),
    ]);
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
      nightsPlayed: data.finished.length,
      joinedTeams: teams.filter((row) => row.status === 'JOINED').length,
      parentLeagueId: league.parent_league_id,
    };
  }

  /** The summary and the table of a league together, with no repeated reads. */
  private async summaryAndStandings(data: LeagueData): Promise<{ summary: LeagueSummaryDto; computed: Computed }> {
    const [summary, computed] = await Promise.all([this.summaryOf(data), this.computeStandings(data)]);
    return { computed, summary: { ...summary, joinedTeams: computed.teams.filter((row) => row.status === 'JOINED').length } };
  }

  async list(hostId: string): Promise<HostLeagueDto[]> {
    const leagues = await this.leagues.listForHost(hostId);
    return Promise.all(
      leagues.map(async (league) => {
        const data = await this.loadData(league);
        const mine = data.hosts.find((row) => row.host_id === hostId)!;
        return { ...(await this.summaryOf(data)), myStatus: mine.status, isOwner: league.owner_host_id === hostId };
      }),
    );
  }

  async detail(hostId: string, leagueId: string): Promise<LeagueDetailDto> {
    const { league, hosts, mine } = await this.requireHostOf(hostId, leagueId);
    const [data, superLeague] = await Promise.all([this.loadData(league, hosts), this.leagues.findSuperLeagueOf(league.id)]);
    const [{ summary, computed }, hostViews] = await Promise.all([
      this.summaryAndStandings(data),
      Promise.all(data.hosts.map(async (row) => ({ id: row.host_id, name: await this.hostName(row.host_id), status: row.status }))),
    ]);
    const isOwner = league.owner_host_id === hostId;
    return {
      ...summary,
      myStatus: mine.status,
      isOwner,
      hosts: hostViews,
      teams: computed.teams.map((row) => ({
        registeredTeamId: row.registered_team_id,
        name: computed.names.get(row.registered_team_id) ?? '—',
        status: row.status,
        pubId: row.pub_id,
      })),
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
    // A Super League is only for the teams that qualified; a co-host brings a venue, not teams.
    if (league.kind === 'LEAGUE') await this.inviteTeamsOf(league, own);
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
    const { standings } = await this.computeStandings(await this.loadData(league));
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
    const { standings } = await this.computeStandings(await this.loadData(parent));
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

  /** What players and the projector may know about a night's league. */
  /**
   * A pub's leaderboard: every registered team that played a finished night there, ranked with the
   * league place points. `year` counts this calendar year's nights only.
   */
  async pubLeaderboard(pubId: string, period: 'year' | 'all'): Promise<PubLeaderboardDto> {
    const pub = await this.pubs.findById(pubId);
    if (!pub) throw new NotFoundException({ code: 'PUB_NOT_FOUND', message: 'Pub not found' });
    const year = String(new Date().getFullYear());
    const finished = (await this.sessions.listFinishedByPub(pubId)).filter(
      (session) => period === 'all' || (session.finished_at ?? session.created_at).startsWith(year),
    );
    const nights = await this.nights({ finished } as LeagueData);
    const teamIds = [
      ...new Set(nights.flatMap((night) => night.teams.map((team) => team.registeredTeamId)).filter((id): id is string => !!id)),
    ];
    const names = await this.teamNames(teamIds);
    const members: LeagueMember[] = teamIds.map((id) => ({ registeredTeamId: id, teamName: names.get(id) ?? '—', pubId }));
    return {
      pub: { id: pub.id, name: pub.name, city: pub.city },
      period,
      nights: nights.length,
      standings: leagueStandings(nights, members),
    };
  }

  async publicInfo(leagueId: string): Promise<{ id: string; name: string; kind: LeagueKind } | null> {
    const league = await this.leagues.findById(leagueId);
    return league && { id: league.id, name: league.name, kind: league.kind };
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

  /** The team's view of a league; null when the team has no row in it (after "playing is joining"). */
  private async teamView(league: LeagueRecord, registeredTeamId: string): Promise<TeamLeagueDto | null> {
    const { summary, computed } = await this.summaryAndStandings(await this.loadData(league));
    const row = computed.teams.find((r) => r.registered_team_id === registeredTeamId);
    return row ? { league: summary, status: row.status, standings: computed.standings } : null;
  }

  /** Leagues of the finished nights the team played, whether or not it was ever invited. */
  private async leaguesPlayedBy(registeredTeamId: string): Promise<string[]> {
    const seats = await this.sessionTeams.listByRegisteredTeam(registeredTeamId);
    const sessions = await Promise.all([...new Set(seats.map((seat) => seat.session_id))].map((id) => this.sessions.findById(id)));
    return sessions.filter((s) => s?.league_id && s.status === 'FINISHED').map((s) => s!.league_id!);
  }

  /** The team's invitations and leagues; a league it played in shows as joined. */
  async forTeam(registeredTeamId: string): Promise<TeamLeagueDto[]> {
    const [invited, playedIds] = await Promise.all([this.leagues.listForTeam(registeredTeamId), this.leaguesPlayedBy(registeredTeamId)]);
    const extraIds = [...new Set(playedIds)].filter((id) => !invited.some((league) => league.id === id));
    const played = (await Promise.all(extraIds.map((id) => this.leagues.findById(id)))).filter(
      (league): league is LeagueRecord => league !== null,
    );
    const views = await Promise.all([...invited, ...played].map((league) => this.teamView(league, registeredTeamId)));
    return views.filter((view): view is TeamLeagueDto => view !== null);
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
    return (await this.teamView(league, registeredTeamId))!;
  }
}
