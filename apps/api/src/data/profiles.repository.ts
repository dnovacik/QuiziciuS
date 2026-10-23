import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AccountRole } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface ProfileRecord {
  id: string;
  display_name: string;
  email: string | null;
  role: AccountRole;
  deactivated_at: string | null;
  created_at: string;
}

export abstract class ProfilesRepository {
  abstract findById(id: string): Promise<ProfileRecord | null>;
  abstract findByEmail(email: string): Promise<ProfileRecord | null>;
  abstract listByRoles(roles: AccountRole[]): Promise<ProfileRecord[]>;
  abstract update(id: string, patch: Partial<Pick<ProfileRecord, 'role' | 'deactivated_at' | 'display_name'>>): Promise<ProfileRecord>;
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

  async update(id: string, patch: Partial<Pick<ProfileRecord, 'role' | 'deactivated_at' | 'display_name'>>): Promise<ProfileRecord> {
    const { data, error } = await this.supabase.getClient().from('profiles').update(patch).eq('id', id).select().single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ProfileRecord;
  }
}
