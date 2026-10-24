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
  /** The question the team last tapped "we're ready" for; ready only while that question is locked in. */
  ready_question_id: string | null;
  ready_fullscreen: boolean;
  /** The table the team said it sits at. */
  table_number?: string | null;
}

export abstract class TeamsRepository {
  abstract findById(teamId: string): Promise<TeamRecord | null>;
  abstract findBySessionAndName(sessionId: string, name: string): Promise<TeamRecord | null>;
  abstract upsertJoin(sessionId: string, name: string, registeredTeamId?: string | null, tableNumber?: string | null): Promise<TeamRecord>;
  abstract findBySessionAndRegisteredTeam(sessionId: string, registeredTeamId: string): Promise<TeamRecord | null>;
  abstract setDeviceTokenHash(teamId: string, tokenHash: string): Promise<TeamRecord>;
  abstract markReady(teamId: string, questionId: string, fullscreen: boolean): Promise<TeamRecord>;
  abstract listBySession(sessionId: string): Promise<TeamRecord[]>;
  /** Every quiz-night team a registered team played as. */
  abstract listByRegisteredTeam(registeredTeamId: string): Promise<TeamRecord[]>;
  /** Links a session team to a registered team and gives it the registered name. */
  abstract linkRegistered(teamId: string, registeredTeamId: string, name: string): Promise<TeamRecord>;
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

  async listByRegisteredTeam(registeredTeamId: string): Promise<TeamRecord[]> {
    const { data, error } = await this.supabase.getClient().from('teams').select().eq('registered_team_id', registeredTeamId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as TeamRecord[];
  }

  async linkRegistered(teamId: string, registeredTeamId: string, name: string): Promise<TeamRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('teams')
      .update({ registered_team_id: registeredTeamId, name })
      .eq('id', teamId)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as TeamRecord;
  }

  async upsertJoin(
    sessionId: string,
    name: string,
    registeredTeamId: string | null = null,
    tableNumber: string | null = null,
  ): Promise<TeamRecord> {
    const row: Record<string, unknown> = { session_id: sessionId, name, is_active: true, joined_at: new Date().toISOString() };
    if (registeredTeamId) row.registered_team_id = registeredTeamId;
    // A rejoin without a table keeps the one given before.
    if (tableNumber) row.table_number = tableNumber;
    const { data, error } = await this.supabase.getClient().from('teams').upsert(row, { onConflict: 'session_id,name' }).select().single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as TeamRecord;
  }

  async markReady(teamId: string, questionId: string, fullscreen: boolean): Promise<TeamRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('teams')
      .update({ ready_question_id: questionId, ready_fullscreen: fullscreen })
      .eq('id', teamId)
      .select()
      .single();
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
