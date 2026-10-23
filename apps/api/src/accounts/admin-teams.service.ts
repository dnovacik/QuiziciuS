import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AdminTeamDto {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  createdAt: string;
  captainEmail: string | null;
}

/** Moderation of self-registered teams (name squatting, fake teams). */
@Injectable()
export class AdminTeamsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<AdminTeamDto[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('registered_teams')
      .select('id,name,badge,badge_color,created_at,captain_id')
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    const teams = (data ?? []) as {
      id: string;
      name: string;
      badge: string;
      badge_color: string;
      created_at: string;
      captain_id: string;
    }[];
    const captainIds = [...new Set(teams.map((team) => team.captain_id))];
    const { data: profiles, error: profileError } = captainIds.length
      ? await client.from('profiles').select('id,email').in('id', captainIds)
      : { data: [], error: null };
    if (profileError) throw new InternalServerErrorException(profileError.message);
    const emailById = new Map(((profiles ?? []) as { id: string; email: string | null }[]).map((row) => [row.id, row.email]));
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      badge: team.badge,
      badgeColor: team.badge_color,
      createdAt: team.created_at,
      captainEmail: emailById.get(team.captain_id) ?? null,
    }));
  }

  async rename(teamId: string, rawName: string): Promise<{ id: string; name: string }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .update({ name: rawName.trim() })
      .eq('id', teamId)
      .select('id,name')
      .maybeSingle();
    if (error?.code === '23505') throw new ConflictException({ code: 'NAME_TAKEN', message: 'Team name is taken' });
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
    return data as { id: string; name: string };
  }

  /** Deletes the team, its roster and pubs; past quiz nights keep their results (the link is cleared). */
  async remove(teamId: string): Promise<void> {
    const { data, error } = await this.supabase.getClient().from('registered_teams').delete().eq('id', teamId).select('id').maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
  }
}
