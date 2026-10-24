import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/** Most players a registered team's roster holds (enforced by `add_registered_team_player`). */
export const MAX_ROSTER = 6;

export interface RegisteredTeamRecord {
  id: string;
  captain_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  badge: string;
  badge_color: string;
  expected_members: number;
  /** Deprecated free-text pub, superseded by `registered_team_pubs`. */
  home_pub: string | null;
  /** 6 digits that let a teammate's phone play a quiz night as the team; null until first shown. */
  access_pin?: string | null;
  /** Secret in the link that lets teammates add their name to the roster; null until first shared. */
  invite_token?: string | null;
  created_at: string;
}

export interface RegisteredTeamPlayerRecord {
  id: string;
  name: string;
  created_at: string;
}

export interface NewRegisteredTeam {
  captainId: string;
  name: string;
  description: string;
  badge: string;
  color: string;
  expectedMembers: number;
}

export type RegisteredTeamPatch = Partial<
  Pick<RegisteredTeamRecord, 'name' | 'description' | 'badge' | 'badge_color' | 'expected_members' | 'access_pin' | 'invite_token'>
>;

interface DbError {
  code?: string;
  message: string;
}

const NAME_TAKEN = () => new ConflictException({ code: 'NAME_TAKEN', message: 'Team name is taken' });
const PLAYER_EXISTS = () => new ConflictException({ code: 'PLAYER_EXISTS', message: 'A player with this name is on the roster' });

/**
 * Permanent teams owned by a captain. Name uniqueness (case-insensitive) and the roster limit
 * live in the database; they surface here as `NAME_TAKEN`, `PLAYER_EXISTS` and `ROSTER_FULL`.
 */
export abstract class RegisteredTeamsRepository {
  /** The captain's teams, newest first. */
  abstract listByCaptain(captainId: string): Promise<RegisteredTeamRecord[]>;
  abstract findById(id: string): Promise<RegisteredTeamRecord | null>;
  abstract isNameTaken(name: string): Promise<boolean>;
  /** The team registered under this name (case-insensitive). */
  abstract findByName(name: string): Promise<RegisteredTeamRecord | null>;
  abstract findByInviteToken(token: string): Promise<RegisteredTeamRecord | null>;
  abstract create(team: NewRegisteredTeam): Promise<RegisteredTeamRecord>;
  abstract update(id: string, patch: RegisteredTeamPatch): Promise<RegisteredTeamRecord>;
  abstract listPlayers(teamId: string): Promise<RegisteredTeamPlayerRecord[]>;
  abstract addPlayer(teamId: string, captainId: string, name: string): Promise<RegisteredTeamPlayerRecord>;
  /** Null when the player is not on this team's roster. */
  abstract renamePlayer(teamId: string, playerId: string, name: string): Promise<RegisteredTeamPlayerRecord | null>;
  /** False when the player is not on this team's roster. */
  abstract removePlayer(teamId: string, playerId: string): Promise<boolean>;
}

@Injectable()
export class SupabaseRegisteredTeamsRepository extends RegisteredTeamsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  private fail(error: DbError, unique: () => Error = NAME_TAKEN): never {
    if (error.code === '23505') throw unique();
    throw new InternalServerErrorException(error.message);
  }

  async listByCaptain(captainId: string): Promise<RegisteredTeamRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .select('*')
      .eq('captain_id', captainId)
      .order('created_at', { ascending: false });
    if (error) this.fail(error);
    return (data ?? []) as RegisteredTeamRecord[];
  }

  async findById(id: string): Promise<RegisteredTeamRecord | null> {
    const { data, error } = await this.supabase.getClient().from('registered_teams').select('*').eq('id', id).maybeSingle();
    if (error) this.fail(error);
    return (data as RegisteredTeamRecord | null) ?? null;
  }

  async isNameTaken(name: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .select('id')
      .eq('normalized_name', name.trim().toLowerCase())
      .limit(1);
    if (error) this.fail(error);
    return Boolean(data?.length);
  }

  async findByName(name: string): Promise<RegisteredTeamRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .select('*')
      .eq('normalized_name', name.trim().toLowerCase())
      .maybeSingle();
    if (error) this.fail(error);
    return (data as RegisteredTeamRecord | null) ?? null;
  }

  async findByInviteToken(token: string): Promise<RegisteredTeamRecord | null> {
    const { data, error } = await this.supabase.getClient().from('registered_teams').select('*').eq('invite_token', token).maybeSingle();
    if (error) this.fail(error);
    return (data as RegisteredTeamRecord | null) ?? null;
  }

  async create(team: NewRegisteredTeam): Promise<RegisteredTeamRecord> {
    const { data, error } = await this.supabase.getClient().rpc('create_registered_team', {
      p_captain: team.captainId,
      p_name: team.name,
      p_description: team.description,
      p_badge: team.badge,
      p_color: team.color,
      p_members: team.expectedMembers,
      p_home_pub: '',
    });
    if (error?.code === '22023') throw new BadRequestException({ code: 'INVALID_NAME', message: 'Invalid team name' });
    if (error) this.fail(error);
    return data as RegisteredTeamRecord;
  }

  async update(id: string, patch: RegisteredTeamPatch): Promise<RegisteredTeamRecord> {
    const { data, error } = await this.supabase.getClient().from('registered_teams').update(patch).eq('id', id).select('*').single();
    if (error) this.fail(error);
    return data as RegisteredTeamRecord;
  }

  async listPlayers(teamId: string): Promise<RegisteredTeamPlayerRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_team_players')
      .select('id,name,created_at')
      .eq('team_id', teamId)
      .order('created_at');
    if (error) this.fail(error);
    return (data ?? []) as RegisteredTeamPlayerRecord[];
  }

  async addPlayer(teamId: string, captainId: string, name: string): Promise<RegisteredTeamPlayerRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('add_registered_team_player', { p_team: teamId, p_captain: captainId, p_name: name });
    if (error?.code === '22023') {
      const code = error.message === 'Roster full' ? 'ROSTER_FULL' : 'INVALID_PLAYER';
      throw new BadRequestException({ code, message: error.message });
    }
    if (error?.code === '42501') throw new ForbiddenException({ code: 'NOT_CAPTAIN', message: 'Not the team captain' });
    if (error) this.fail(error, PLAYER_EXISTS);
    const player = data as RegisteredTeamPlayerRecord & { team_id?: string };
    return { id: player.id, name: player.name, created_at: player.created_at };
  }

  async renamePlayer(teamId: string, playerId: string, name: string): Promise<RegisteredTeamPlayerRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_team_players')
      .update({ name })
      .eq('id', playerId)
      .eq('team_id', teamId)
      .select('id,name,created_at')
      .maybeSingle();
    if (error) this.fail(error, PLAYER_EXISTS);
    return (data as RegisteredTeamPlayerRecord | null) ?? null;
  }

  async removePlayer(teamId: string, playerId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_team_players')
      .delete()
      .eq('id', playerId)
      .eq('team_id', teamId)
      .select('id')
      .maybeSingle();
    if (error) this.fail(error);
    return Boolean(data);
  }
}
