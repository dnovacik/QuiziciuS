import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LeagueHostStatus, LeagueKind, LeagueTeamStatus } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface LeagueRecord {
  id: string;
  name: string;
  kind: LeagueKind;
  owner_host_id: string;
  starts_on: string;
  ends_on: string | null;
  message: string | null;
  parent_league_id: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface LeagueHostRecord {
  league_id: string;
  host_id: string;
  status: LeagueHostStatus;
}

export interface LeaguePubRecord {
  league_id: string;
  pub_id: string;
  host_id: string;
}

export interface LeagueTeamRecord {
  league_id: string;
  registered_team_id: string;
  status: LeagueTeamStatus;
  pub_id: string | null;
}

export interface LeagueResultRecord {
  league_id: string;
  registered_team_id: string | null;
  team_name: string;
  pub_id: string | null;
  rank: number;
  points: number;
  nights: number;
  placements: number[];
}

export type NewLeague = Omit<LeagueRecord, 'id' | 'created_at' | 'closed_at'>;
export type LeaguePatch = Partial<Pick<LeagueRecord, 'name' | 'starts_on' | 'ends_on' | 'message' | 'closed_at'>>;

/** A registered team connected to a pub, with its primary pub (for the qualification snapshot). */
export interface PubTeam {
  registeredTeamId: string;
  primaryPubId: string | null;
}

export abstract class LeaguesRepository {
  abstract create(league: NewLeague): Promise<LeagueRecord>;
  abstract findById(id: string): Promise<LeagueRecord | null>;
  abstract update(id: string, patch: LeaguePatch): Promise<LeagueRecord>;
  abstract findSuperLeagueOf(parentId: string): Promise<LeagueRecord | null>;
  /** Leagues the host owns, runs or is invited to. */
  abstract listForHost(hostId: string): Promise<LeagueRecord[]>;
  /** Leagues the team is invited to, joined or declined. */
  abstract listForTeam(registeredTeamId: string): Promise<LeagueRecord[]>;
  abstract hosts(leagueId: string): Promise<LeagueHostRecord[]>;
  abstract setHost(leagueId: string, hostId: string, status: LeagueHostStatus): Promise<void>;
  abstract pubs(leagueId: string): Promise<LeaguePubRecord[]>;
  abstract addPubs(leagueId: string, hostId: string, pubIds: string[]): Promise<void>;
  abstract teams(leagueId: string): Promise<LeagueTeamRecord[]>;
  /** Inserts INVITED rows; teams already in the league keep their row. */
  abstract inviteTeams(leagueId: string, teams: { registeredTeamId: string; pubId: string | null }[]): Promise<void>;
  abstract setTeamStatus(leagueId: string, registeredTeamId: string, status: LeagueTeamStatus, pubId?: string | null): Promise<void>;
  abstract results(leagueId: string): Promise<LeagueResultRecord[]>;
  abstract saveResults(leagueId: string, rows: LeagueResultRecord[]): Promise<void>;
  /** Registered teams that have one of the pubs, or played a finished quiz night at one of them. */
  abstract teamsOfPubs(pubIds: string[]): Promise<PubTeam[]>;
}

@Injectable()
export class SupabaseLeaguesRepository extends LeaguesRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  private get db() {
    return this.supabase.getClient();
  }

  private check(error: { message: string } | null): void {
    if (error) throw new InternalServerErrorException(error.message);
  }

  async create(league: NewLeague): Promise<LeagueRecord> {
    const { data, error } = await this.db.from('leagues').insert(league).select().single();
    this.check(error);
    return data as LeagueRecord;
  }

  async findById(id: string): Promise<LeagueRecord | null> {
    const { data, error } = await this.db.from('leagues').select().eq('id', id).maybeSingle();
    this.check(error);
    return (data as LeagueRecord | null) ?? null;
  }

  async update(id: string, patch: LeaguePatch): Promise<LeagueRecord> {
    const { data, error } = await this.db.from('leagues').update(patch).eq('id', id).select().single();
    this.check(error);
    return data as LeagueRecord;
  }

  async findSuperLeagueOf(parentId: string): Promise<LeagueRecord | null> {
    const { data, error } = await this.db.from('leagues').select().eq('parent_league_id', parentId).maybeSingle();
    this.check(error);
    return (data as LeagueRecord | null) ?? null;
  }

  private async leaguesByIds(ids: string[]): Promise<LeagueRecord[]> {
    if (!ids.length) return [];
    const { data, error } = await this.db.from('leagues').select().in('id', ids).order('starts_on', { ascending: false });
    this.check(error);
    return (data ?? []) as LeagueRecord[];
  }

  async listForHost(hostId: string): Promise<LeagueRecord[]> {
    const { data, error } = await this.db.from('league_hosts').select('league_id').eq('host_id', hostId);
    this.check(error);
    return this.leaguesByIds(((data ?? []) as { league_id: string }[]).map((row) => row.league_id));
  }

  async listForTeam(registeredTeamId: string): Promise<LeagueRecord[]> {
    const { data, error } = await this.db.from('league_teams').select('league_id').eq('registered_team_id', registeredTeamId);
    this.check(error);
    return this.leaguesByIds(((data ?? []) as { league_id: string }[]).map((row) => row.league_id));
  }

  async hosts(leagueId: string): Promise<LeagueHostRecord[]> {
    const { data, error } = await this.db.from('league_hosts').select('league_id,host_id,status').eq('league_id', leagueId);
    this.check(error);
    return (data ?? []) as LeagueHostRecord[];
  }

  async setHost(leagueId: string, hostId: string, status: LeagueHostStatus): Promise<void> {
    const { error } = await this.db
      .from('league_hosts')
      .upsert({ league_id: leagueId, host_id: hostId, status, responded_at: status === 'INVITED' ? null : new Date().toISOString() });
    this.check(error);
  }

  async pubs(leagueId: string): Promise<LeaguePubRecord[]> {
    const { data, error } = await this.db.from('league_pubs').select('league_id,pub_id,host_id').eq('league_id', leagueId);
    this.check(error);
    return (data ?? []) as LeaguePubRecord[];
  }

  async addPubs(leagueId: string, hostId: string, pubIds: string[]): Promise<void> {
    if (!pubIds.length) return;
    const { error } = await this.db.from('league_pubs').upsert(
      pubIds.map((pubId) => ({ league_id: leagueId, pub_id: pubId, host_id: hostId })),
      { onConflict: 'league_id,pub_id', ignoreDuplicates: true },
    );
    this.check(error);
  }

  async teams(leagueId: string): Promise<LeagueTeamRecord[]> {
    const { data, error } = await this.db
      .from('league_teams')
      .select('league_id,registered_team_id,status,pub_id')
      .eq('league_id', leagueId);
    this.check(error);
    return (data ?? []) as LeagueTeamRecord[];
  }

  async inviteTeams(leagueId: string, teams: { registeredTeamId: string; pubId: string | null }[]): Promise<void> {
    if (!teams.length) return;
    const { error } = await this.db.from('league_teams').upsert(
      teams.map((team) => ({ league_id: leagueId, registered_team_id: team.registeredTeamId, status: 'INVITED', pub_id: team.pubId })),
      { onConflict: 'league_id,registered_team_id', ignoreDuplicates: true },
    );
    this.check(error);
  }

  async setTeamStatus(leagueId: string, registeredTeamId: string, status: LeagueTeamStatus, pubId?: string | null): Promise<void> {
    const row: Record<string, unknown> = { league_id: leagueId, registered_team_id: registeredTeamId, status };
    if (pubId !== undefined) row.pub_id = pubId;
    if (status === 'JOINED') row.joined_at = new Date().toISOString();
    const { error } = await this.db.from('league_teams').upsert(row, { onConflict: 'league_id,registered_team_id' });
    this.check(error);
  }

  async results(leagueId: string): Promise<LeagueResultRecord[]> {
    const { data, error } = await this.db.from('league_results').select().eq('league_id', leagueId).order('rank');
    this.check(error);
    return (data ?? []) as LeagueResultRecord[];
  }

  async saveResults(leagueId: string, rows: LeagueResultRecord[]): Promise<void> {
    const { error: deleteError } = await this.db.from('league_results').delete().eq('league_id', leagueId);
    this.check(deleteError);
    if (!rows.length) return;
    const { error } = await this.db.from('league_results').insert(rows);
    this.check(error);
  }

  async teamsOfPubs(pubIds: string[]): Promise<PubTeam[]> {
    if (!pubIds.length) return [];
    const { data: withPub, error: pubError } = await this.db.from('registered_team_pubs').select('team_id').in('pub_id', pubIds);
    this.check(pubError);
    const { data: nights, error: nightError } = await this.db
      .from('quiz_sessions')
      .select('id')
      .in('pub_id', pubIds)
      .eq('status', 'FINISHED');
    this.check(nightError);
    const sessionIds = ((nights ?? []) as { id: string }[]).map((row) => row.id);
    let played: { registered_team_id: string | null }[] = [];
    if (sessionIds.length) {
      const { data, error } = await this.db
        .from('teams')
        .select('registered_team_id')
        .in('session_id', sessionIds)
        .not('registered_team_id', 'is', null);
      this.check(error);
      played = (data ?? []) as { registered_team_id: string | null }[];
    }
    const teamIds = [
      ...new Set([
        ...((withPub ?? []) as { team_id: string }[]).map((row) => row.team_id),
        ...played.map((row) => row.registered_team_id).filter((id): id is string => id !== null),
      ]),
    ];
    if (!teamIds.length) return [];
    const { data: primaries, error: primaryError } = await this.db
      .from('registered_team_pubs')
      .select('team_id,pub_id')
      .in('team_id', teamIds)
      .eq('is_primary', true);
    this.check(primaryError);
    const primaryOf = new Map(((primaries ?? []) as { team_id: string; pub_id: string }[]).map((row) => [row.team_id, row.pub_id]));
    return teamIds.map((id) => ({ registeredTeamId: id, primaryPubId: primaryOf.get(id) ?? null }));
  }
}
