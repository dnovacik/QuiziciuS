import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AccountRole } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface ProfileRecord {
  id: string;
  display_name: string;
  email: string | null;
  role: AccountRole;
  deactivated_at: string | null;
  /** Last day (inclusive, `YYYY-MM-DD`) the host may launch quiz nights. */
  subscribed_until: string | null;
  subscription_forever: boolean;
  subscription_trial: boolean;
  created_at: string;
}

export type ProfilePatch = Partial<
  Pick<ProfileRecord, 'role' | 'deactivated_at' | 'display_name' | 'subscribed_until' | 'subscription_forever' | 'subscription_trial'>
>;

export abstract class ProfilesRepository {
  abstract findById(id: string): Promise<ProfileRecord | null>;
  abstract findByEmail(email: string): Promise<ProfileRecord | null>;
  abstract listByRoles(roles: AccountRole[]): Promise<ProfileRecord[]>;
  abstract update(id: string, patch: ProfilePatch): Promise<ProfileRecord>;
}

@Injectable()
export class SupabaseProfilesRepository extends ProfilesRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(id: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.supabase.getClient().from('profiles').select().eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ProfileRecord | null;
  }

  async findByEmail(email: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.supabase.getClient().from('profiles').select().ilike('email', email.trim()).maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ProfileRecord | null;
  }

  async listByRoles(roles: AccountRole[]): Promise<ProfileRecord[]> {
    const { data, error } = await this.supabase.getClient().from('profiles').select().in('role', roles).order('created_at');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as ProfileRecord[];
  }

  async update(id: string, patch: ProfilePatch): Promise<ProfileRecord> {
    const { data, error } = await this.supabase.getClient().from('profiles').update(patch).eq('id', id).select().single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ProfileRecord;
  }
}
