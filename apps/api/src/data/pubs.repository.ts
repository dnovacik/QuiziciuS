import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface PubRecord {
  id: string;
  name: string;
  city: string;
  address: string | null;
  created_at: string;
}

export interface TeamPubRecord extends PubRecord {
  is_primary: boolean;
}

export interface NewPub {
  name: string;
  city: string;
  address: string | null;
}

/** The key `pubs.normalized_key` is generated from; two pubs with the same key are the same place. */
export function pubKey(name: string, city: string): string {
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
}

export abstract class PubsRepository {
  /** Every pub, optionally filtered by a name/city fragment, sorted by name. */
  abstract search(query: string | null): Promise<PubRecord[]>;
  abstract findById(id: string): Promise<PubRecord | null>;
  abstract findByKey(name: string, city: string): Promise<PubRecord | null>;
  abstract create(pub: NewPub, createdBy: string): Promise<PubRecord>;
  abstract listForHost(hostId: string): Promise<PubRecord[]>;
  abstract linkHost(hostId: string, pubId: string): Promise<void>;
  abstract unlinkHost(hostId: string, pubId: string): Promise<void>;
  abstract listForTeam(teamId: string): Promise<TeamPubRecord[]>;
  /** Replaces the team's pubs; `primaryPubId` must be one of `pubIds` unless the list is empty. */
  abstract setTeamPubs(teamId: string, pubIds: string[], primaryPubId: string | null): Promise<void>;
}

const PUB_COLUMNS = 'id,name,city,address,created_at';

@Injectable()
export class SupabasePubsRepository extends PubsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async search(query: string | null): Promise<PubRecord[]> {
    let request = this.supabase.getClient().from('pubs').select(PUB_COLUMNS).order('name').limit(200);
    const term = query?.trim().replace(/[%_,()]/g, '');
    if (term) request = request.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
    const { data, error } = await request;
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as PubRecord[];
  }

  async findById(id: string): Promise<PubRecord | null> {
    const { data, error } = await this.supabase.getClient().from('pubs').select(PUB_COLUMNS).eq('id', id).maybeSingle();
    if (error) return null;
    return data as PubRecord | null;
  }

  async findByKey(name: string, city: string): Promise<PubRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pubs')
      .select(PUB_COLUMNS)
      .eq('normalized_key', pubKey(name, city))
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data as PubRecord | null;
  }

  async create(pub: NewPub, createdBy: string): Promise<PubRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pubs')
      .insert({ ...pub, created_by: createdBy })
      .select(PUB_COLUMNS)
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as PubRecord;
  }

  async listForHost(hostId: string): Promise<PubRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('host_pubs')
      .select(`pubs(${PUB_COLUMNS})`)
      .eq('host_id', hostId)
      .order('added_at');
    if (error) throw new InternalServerErrorException(error.message);
    return ((data ?? []) as unknown as { pubs: PubRecord }[]).map((row) => row.pubs);
  }

  async linkHost(hostId: string, pubId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('host_pubs')
      .upsert({ host_id: hostId, pub_id: pubId }, { onConflict: 'host_id,pub_id', ignoreDuplicates: true });
    if (error) throw new InternalServerErrorException(error.message);
  }

  async unlinkHost(hostId: string, pubId: string): Promise<void> {
    const { error } = await this.supabase.getClient().from('host_pubs').delete().eq('host_id', hostId).eq('pub_id', pubId);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async listForTeam(teamId: string): Promise<TeamPubRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_team_pubs')
      .select(`is_primary, pubs(${PUB_COLUMNS})`)
      .eq('team_id', teamId);
    if (error) throw new InternalServerErrorException(error.message);
    return ((data ?? []) as unknown as { is_primary: boolean; pubs: PubRecord }[])
      .map((row) => ({ ...row.pubs, is_primary: row.is_primary }))
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name));
  }

  async setTeamPubs(teamId: string, pubIds: string[], primaryPubId: string | null): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .rpc('set_registered_team_pubs', { p_team: teamId, p_pubs: pubIds, p_primary: primaryPubId });
    if (error) throw new InternalServerErrorException(error.message);
  }
}
