import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { ClaimSeatDto, EditTeamDto, PinJoinDto, PlayerDto, RegisterTeamDto, RotateAccessDto } from './dto/registered-team.dto';
import { RegisteredTeamsService } from './registered-teams.service';

@Controller('registered-teams')
@RequireRole('TEAM_CAPTAIN')
export class RegisteredTeamsController {
  constructor(private readonly teams: RegisteredTeamsService) {}

  @Get('mine')
  mine(@CurrentHost() user: CurrentHostPayload) {
    return this.teams.mine(user.id);
  }

  @Get('availability/:name')
  availability(@Param('name') name: string) {
    return this.teams.availability(name);
  }

  @Post()
  create(@CurrentHost() user: CurrentHostPayload, @Body() dto: RegisterTeamDto) {
    return this.teams.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Body() dto: EditTeamDto) {
    return this.teams.update(user.id, id, dto);
  }

  /** The team PIN and invite link secret (created on first use). */
  @Get(':id/access')
  access(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string) {
    return this.teams.access(user.id, id);
  }

  @Post(':id/access/rotate')
  rotateAccess(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Body() dto: RotateAccessDto) {
    return this.teams.rotateAccess(user.id, id, dto.what);
  }

  @Post(':id/sessions/:sessionId/join')
  joinSession(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Param('sessionId') sessionId: string) {
    return this.teams.joinSession(user.id, id, sessionId);
  }

  @Post(':id/sessions/:sessionId/claim')
  claimSeat(
    @CurrentHost() user: CurrentHostPayload,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ClaimSeatDto,
  ) {
    return this.teams.claimSeat(user.id, id, sessionId, dto.teamToken);
  }

  @Get(':id/leagues')
  leagues(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string) {
    return this.teams.leagues(user.id, id);
  }

  @Post(':id/leagues/:leagueId/join')
  joinLeague(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Param('leagueId') leagueId: string) {
    return this.teams.respondToLeague(user.id, id, leagueId, true);
  }

  @Post(':id/leagues/:leagueId/decline')
  declineLeague(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Param('leagueId') leagueId: string) {
    return this.teams.respondToLeague(user.id, id, leagueId, false);
  }

  @Get(':id/players')
  players(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string) {
    return this.teams.players(user.id, id);
  }

  @Post(':id/players')
  addPlayer(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Body() dto: PlayerDto) {
    return this.teams.addPlayer(user.id, id, dto.name);
  }

  @Patch(':id/players/:playerId')
  renamePlayer(
    @CurrentHost() user: CurrentHostPayload,
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @Body() dto: PlayerDto,
  ) {
    return this.teams.renamePlayer(user.id, id, playerId, dto.name);
  }

  @Delete(':id/players/:playerId')
  removePlayer(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string, @Param('playerId') playerId: string) {
    return this.teams.removePlayer(user.id, id, playerId);
  }
}

/**
 * Public: teammates without accounts reach their registered team through the captain's invite
 * link (to get on the roster) or the team PIN (to play a quiz night as the team).
 */
@Controller('team-access')
export class TeamAccessController {
  constructor(private readonly teams: RegisteredTeamsService) {}

  @Get('invite/:token')
  invite(@Param('token') token: string) {
    return this.teams.invitePreview(token);
  }

  @Post('invite/:token/players')
  joinRoster(@Param('token') token: string, @Body() dto: PlayerDto) {
    return this.teams.joinRosterByInvite(token, dto.name);
  }

  @Post('sessions/:sessionId/join')
  joinWithPin(@Param('sessionId') sessionId: string, @Body() dto: PinJoinDto) {
    return this.teams.joinSessionWithPin(sessionId, dto.name, dto.pin, dto.tableNumber?.trim() || null);
  }
}
