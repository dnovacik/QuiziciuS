import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InfractionType } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface InfractionRecord {
  id: string;
  session_id: string;
  team_id: string;
  type: InfractionType;
  detected_at: string;
  reviewed: boolean;
}

export abstract class InfractionsRepository {
  abstract create(sessionId: string, teamId: string, type: InfractionType): Promise<InfractionRecord>;
  abstract findById(infractionId: string): Promise<InfractionRecord | null>;
  abstract listBySession(sessionId: string): Promise<InfractionRecord[]>;
  abstract markReviewed(infractionId: string): Promise<InfractionRecord>;
}

@Injectable()
export class SupabaseInfractionsRepository extends InfractionsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(sessionId: string, teamId: string, type: InfractionType): Promise<InfractionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('infractions')
      .insert({ session_id: sessionId, team_id: teamId, type })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as InfractionRecord;
  }

  async findById(infractionId: string): Promise<InfractionRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('infractions')
      .select()
      .eq('id', infractionId)
      .single();
    if (error) return null;
    return (data as InfractionRecord) ?? null;
  }

  async listBySession(sessionId: string): Promise<InfractionRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('infractions')
      .select()
      .eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as InfractionRecord[];
  }

  async markReviewed(infractionId: string): Promise<InfractionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('infractions')
      .update({ reviewed: true })
      .eq('id', infractionId)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as InfractionRecord;
  }
}
