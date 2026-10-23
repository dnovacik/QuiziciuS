import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TeamRecord {
  id: string;
  session_id: string;
  name: string;
  device_token_hash: string | null;
  joined_at: string;
  is_active: boolean;
  /** Set when the team joined as a registered team (through its captain). */
  registered_team_id: string | null;
}

export abstract class TeamsRepository {
  abstract findById(teamId: string): Promise<TeamRecord | null>;
  abstract findBySessionAndName(sessionId: string, name: string): Promise<TeamRecord | null>;
  abstract upsertJoin(sessionId: string, name: string, registeredTeamId?: string | null): Promise<TeamRecord>;
  abstract findBySessionAndRegisteredTeam(sessionId: string, registeredTeamId: string): Promise<TeamRecord | null>;
  abstract setDeviceTokenHash(teamId: string, tokenHash: string): Promise<TeamRecord>;
  abstract listBySession(sessionId: string): Promise<TeamRecord[]>;
}

@Injectable()
export class SupabaseTeamsRepository extends TeamsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(teamId: string): Promise<TeamRecord | null> {
    const { data, error } = await this.supabase.getClient().from('teams').select().eq('id', teamId).single();
    if (error) return null;
    return data as TeamRecord;
  }

  async findBySessionAndName(sessionId: string, name: string): Promise<TeamRecord | null> {
    const { data, error } = await this.supabase.getClient().from('teams').select().eq('session_id', sessionId).eq('name', name).single();
    if (error) return null;
    return data as TeamRecord;
  }

  async findBySessionAndRegisteredTeam(sessionId: string, registeredTeamId: string): Promise<TeamRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('teams')
      .select()
      .eq('session_id', sessionId)
      .eq('registered_team_id', registeredTeamId)
      .maybeSingle();
    if (error) return null;
    return data as TeamRecord | null;
  }

  async upsertJoin(sessionId: string, name: string, registeredTeamId: string | null = null): Promise<TeamRecord> {
    const row: Record<string, unknown> = { session_id: sessionId, name, is_active: true, joined_at: new Date().toISOString() };
    if (registeredTeamId) row.registered_team_id = registeredTeamId;
    const { data, error } = await this.supabase.getClient().from('teams').upsert(row, { onConflict: 'session_id,name' }).select().single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as TeamRecord;
  }

  async setDeviceTokenHash(teamId: string, tokenHash: string): Promise<TeamRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('teams')
      .update({ device_token_hash: tokenHash })
      .eq('id', teamId)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as TeamRecord;
  }

  async listBySession(sessionId: string): Promise<TeamRecord[]> {
    const { data, error } = await this.supabase.getClient().from('teams').select().eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as TeamRecord[];
  }
}
