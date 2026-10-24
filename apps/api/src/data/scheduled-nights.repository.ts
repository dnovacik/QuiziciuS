import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ScheduledNightRecord {
  id: string;
  host_id: string;
  pub_id: string;
  quiz_id: string | null;
  starts_at: string;
  note: string | null;
  created_at: string;
}

export type ScheduledNightInput = Pick<ScheduledNightRecord, 'pub_id' | 'quiz_id' | 'starts_at' | 'note'>;

/** Quiz nights planned ahead (no reservations): a host's plan, and what is coming up at a pub. */
export abstract class ScheduledNightsRepository {
  abstract findById(id: string): Promise<ScheduledNightRecord | null>;
  /** The host's nights starting at or after `from`, soonest first. */
  abstract listByHost(hostId: string, from: string): Promise<ScheduledNightRecord[]>;
  /** Nights at any of the pubs starting at or after `from`, soonest first. */
  abstract listByPubs(pubIds: string[], from: string): Promise<ScheduledNightRecord[]>;
  abstract create(hostId: string, input: ScheduledNightInput): Promise<ScheduledNightRecord>;
  abstract update(id: string, input: ScheduledNightInput): Promise<ScheduledNightRecord>;
  abstract remove(id: string): Promise<void>;
}

@Injectable()
export class SupabaseScheduledNightsRepository extends ScheduledNightsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(id: string): Promise<ScheduledNightRecord | null> {
    const { data, error } = await this.supabase.getClient().from('scheduled_nights').select('*').eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return (data as ScheduledNightRecord | null) ?? null;
  }

  async listByHost(hostId: string, from: string): Promise<ScheduledNightRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('scheduled_nights')
      .select('*')
      .eq('host_id', hostId)
      .gte('starts_at', from)
      .order('starts_at');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as ScheduledNightRecord[];
  }

  async listByPubs(pubIds: string[], from: string): Promise<ScheduledNightRecord[]> {
    if (!pubIds.length) return [];
    const { data, error } = await this.supabase
      .getClient()
      .from('scheduled_nights')
      .select('*')
      .in('pub_id', pubIds)
      .gte('starts_at', from)
      .order('starts_at');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as ScheduledNightRecord[];
  }

  async create(hostId: string, input: ScheduledNightInput): Promise<ScheduledNightRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('scheduled_nights')
      .insert({ host_id: hostId, ...input })
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ScheduledNightRecord;
  }

  async update(id: string, input: ScheduledNightInput): Promise<ScheduledNightRecord> {
    const { data, error } = await this.supabase.getClient().from('scheduled_nights').update(input).eq('id', id).select('*').single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ScheduledNightRecord;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.getClient().from('scheduled_nights').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }
}
