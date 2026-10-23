import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { HostLeagueDto, InvitableHostDto, LeagueDetailDto } from '@quizicius/shared-types';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { AcceptLeagueDto, CreateLeagueDto, UpdateLeagueDto } from './dto/league.dto';
import { LeaguesService } from './leagues.service';

@Controller('leagues')
@RequireRole('HOST')
export class LeaguesController {
  constructor(private readonly leagues: LeaguesService) {}

  @Get()
  list(@CurrentHost() host: CurrentHostPayload): Promise<HostLeagueDto[]> {
    return this.leagues.list(host.id);
  }

  @Post()
  create(@CurrentHost() host: CurrentHostPayload, @Body() dto: CreateLeagueDto): Promise<LeagueDetailDto> {
    return this.leagues.create(host.id, dto);
  }

  /** Hosts that can be invited to run a league together. */
  @Get('hosts')
  invitableHosts(@CurrentHost() host: CurrentHostPayload): Promise<InvitableHostDto[]> {
    return this.leagues.invitableHosts(host.id);
  }

  @Get(':leagueId')
  detail(@CurrentHost() host: CurrentHostPayload, @Param('leagueId') leagueId: string): Promise<LeagueDetailDto> {
    return this.leagues.detail(host.id, leagueId);
  }

  @Patch(':leagueId')
  update(
    @CurrentHost() host: CurrentHostPayload,
    @Param('leagueId') leagueId: string,
    @Body() dto: UpdateLeagueDto,
  ): Promise<LeagueDetailDto> {
    return this.leagues.update(host.id, leagueId, dto);
  }

  @Post(':leagueId/hosts/me/accept')
  accept(
    @CurrentHost() host: CurrentHostPayload,
    @Param('leagueId') leagueId: string,
    @Body() dto: AcceptLeagueDto,
  ): Promise<LeagueDetailDto> {
    return this.leagues.respond(host.id, leagueId, true, dto.pubIds);
  }

  @Post(':leagueId/hosts/me/decline')
  decline(@CurrentHost() host: CurrentHostPayload, @Param('leagueId') leagueId: string): Promise<LeagueDetailDto> {
    return this.leagues.respond(host.id, leagueId, false, []);
  }

  @Post(':leagueId/close')
  close(@CurrentHost() host: CurrentHostPayload, @Param('leagueId') leagueId: string): Promise<LeagueDetailDto> {
    return this.leagues.close(host.id, leagueId);
  }

  @Post(':leagueId/super-league')
  createSuperLeague(@CurrentHost() host: CurrentHostPayload, @Param('leagueId') leagueId: string): Promise<LeagueDetailDto> {
    return this.leagues.createSuperLeague(host.id, leagueId);
  }
}
