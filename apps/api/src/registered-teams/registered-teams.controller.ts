import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PubsService } from '../pubs/pubs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { JoinResult, TeamsService } from '../teams/teams.service';
import { EditTeamDto, PlayerDto, RegisterTeamDto } from './dto/registered-team.dto';

@Controller('registered-teams')
@UseGuards(SupabaseAuthGuard)
export class RegisteredTeamsController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pubs: PubsService,
    private readonly sessionTeams: TeamsService,
  ) {}

  /** A registered team as the web app sees it: the row plus its pubs (primary first). */
  private async withPubs<T extends { id: string }>(team: T) {
    const pubs = await this.pubs.listForTeam(team.id);
    return {
      ...team,
      pubs: pubs.map((pub) => ({ id: pub.id, name: pub.name, city: pub.city, isPrimary: pub.is_primary })),
    };
  }
  @Get('mine')
  async mine(@CurrentHost() user: CurrentHostPayload) {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .select('*')
      .eq('captain_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Promise.all((data ?? []).map((team) => this.withPubs(team)));
  }
  @Get('availability/:name')
  async availability(@Param('name') name: string) {
    const normalized = name.trim().toLowerCase();
    if (normalized.length < 3 || normalized.length > 30) return { available: false, code: 'INVALID_NAME' };
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .select('id')
      .eq('normalized_name', normalized)
      .limit(1);
    if (error) throw error;
    return { available: !data?.length, code: data?.length ? 'NAME_TAKEN' : 'NAME_AVAILABLE' };
  }
  @Post()
  async create(@CurrentHost() user: CurrentHostPayload, @Body() dto: RegisterTeamDto) {
    const name = dto.name.trim();
    if (name.length < 3 || name.length > 30) throw new BadRequestException({ code: 'INVALID_NAME' });
    const { data, error } = await this.supabase.getClient().rpc('create_registered_team', {
      p_captain: user.id,
      p_name: name,
      p_description: dto.description ?? '',
      p_badge: dto.badge ?? 'shield',
      p_color: dto.color ?? 'purple',
      p_members: dto.expectedMembers,
      p_home_pub: '',
    });
    if (error) {
      if (error.code === '23505') throw new ConflictException({ code: 'NAME_TAKEN' });
      if (error.code === '22023') throw new BadRequestException({ code: 'INVALID_NAME' });
      throw error;
    }
    const team = data as { id: string };
    if (dto.pubIds?.length) await this.pubs.setTeamPubs(team.id, dto.pubIds, dto.primaryPubId);
    return this.withPubs(team);
  }
  private async own(teamId: string, userId: string): Promise<{ id: string; name: string }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .select('id,name')
      .eq('id', teamId)
      .eq('captain_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException({ code: 'TEAM_NOT_FOUND' });
    return data;
  }
  /** The captain joins a live session as the registered team, which links the session team to it. */
  @Post(':id/sessions/:sessionId/join')
  async joinSession(
    @CurrentHost() user: CurrentHostPayload,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ): Promise<JoinResult> {
    const team = await this.own(id, user.id);
    return this.sessionTeams.join(sessionId, team.name, team.id);
  }
  @Get(':id/players')
  async players(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string) {
    await this.own(id, user.id);
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_team_players')
      .select('id,name,created_at')
      .eq('team_id', id)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  }
  @Post(':id/players')
  async addPlayer(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Body() dto: PlayerDto) {
    await this.own(id, user.id);
    const { data, error } = await this.supabase
      .getClient()
      .rpc('add_registered_team_player', { p_team: id, p_captain: user.id, p_name: dto.name });
    if (error) {
      if (error.code === '23505') throw new ConflictException({ code: 'PLAYER_EXISTS' });
      if (error.code === '22023')
        throw new BadRequestException({ code: error.message === 'Roster full' ? 'ROSTER_FULL' : 'INVALID_PLAYER' });
      if (error.code === '42501') throw new ForbiddenException({ code: 'NOT_CAPTAIN' });
      throw error;
    }
    return data;
  }
  @Patch(':id/players/:playerId')
  async renamePlayer(
    @CurrentHost() user: CurrentHostPayload,
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @Body() dto: PlayerDto,
  ) {
    await this.own(id, user.id);
    const value = dto.name.trim();
    if (!value) throw new BadRequestException({ code: 'INVALID_PLAYER' });
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_team_players')
      .update({ name: value })
      .eq('id', playerId)
      .eq('team_id', id)
      .select('id,name,created_at')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') throw new ConflictException({ code: 'PLAYER_EXISTS' });
      throw error;
    }
    if (!data) throw new NotFoundException({ code: 'PLAYER_NOT_FOUND' });
    return data;
  }
  @Delete(':id/players/:playerId')
  async removePlayer(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Param('playerId') playerId: string) {
    await this.own(id, user.id);
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_team_players')
      .delete()
      .eq('id', playerId)
      .eq('team_id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException({ code: 'PLAYER_NOT_FOUND' });
    return { deleted: true };
  }
  @Patch(':id')
  async update(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Body() dto: EditTeamDto) {
    await this.own(id, user.id);
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 3) throw new BadRequestException({ code: 'INVALID_NAME' });
      patch.name = name;
    }
    if (dto.description !== undefined) patch.description = dto.description.trim() || null;
    if (dto.badge !== undefined) patch.badge = dto.badge;
    if (dto.color !== undefined) patch.badge_color = dto.color;
    if (dto.expectedMembers !== undefined) patch.expected_members = dto.expectedMembers;
    const pubsChanged = dto.pubIds !== undefined;
    if (!Object.keys(patch).length && !pubsChanged) throw new BadRequestException({ code: 'NO_CHANGES' });
    if (pubsChanged) await this.pubs.setTeamPubs(id, dto.pubIds ?? [], dto.primaryPubId);
    if (!Object.keys(patch).length) {
      await this.own(id, user.id);
      const { data, error } = await this.supabase.getClient().from('registered_teams').select('*').eq('id', id).single();
      if (error) throw error;
      return this.withPubs(data as { id: string });
    }
    const { data, error } = await this.supabase
      .getClient()
      .from('registered_teams')
      .update(patch)
      .eq('id', id)
      .eq('captain_id', user.id)
      .select('*')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') throw new ConflictException({ code: 'NAME_TAKEN' });
      throw error;
    }
    if (!data) throw new NotFoundException({ code: 'TEAM_NOT_FOUND' });
    return this.withPubs(data as { id: string });
  }
}
