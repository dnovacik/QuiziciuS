import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AccountDto } from '@quizicius/shared-types';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { AccountsService, AdminHostDto } from './accounts.service';
import { AdminTeamDto, AdminTeamsService } from './admin-teams.service';
import { RenameTeamDto, SetHostActiveDto, SetSubscriptionDto } from './dto/admin-patch.dto';
import { InviteHostDto } from './dto/invite-host.dto';
import { RenameAccountDto } from './dto/rename-account.dto';

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  /** The signed-in account and its role; the web app routes on this. */
  @Get('me')
  @RequireRole('TEAM_CAPTAIN')
  me(@CurrentHost() account: CurrentHostPayload): Promise<AccountDto> {
    return this.accounts.me(account.id);
  }

  /** Sets the signed-in account's own name, e.g. a captain's, shown instead of the e-mail. */
  @Patch('me')
  @RequireRole('TEAM_CAPTAIN')
  rename(@CurrentHost() account: CurrentHostPayload, @Body() dto: RenameAccountDto): Promise<AccountDto> {
    return this.accounts.rename(account.id, dto.displayName);
  }
}

@Controller('admin')
@RequireRole('SUPER_ADMIN')
export class AdminController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly teams: AdminTeamsService,
  ) {}

  @Get('hosts')
  hosts(): Promise<AdminHostDto[]> {
    return this.accounts.listHosts();
  }

  @Post('hosts')
  inviteHost(@Body() dto: InviteHostDto) {
    return this.accounts.inviteHost(dto.email, dto.displayName);
  }

  @Patch('hosts/:hostId')
  setHostActive(@Param('hostId') hostId: string, @Body() dto: SetHostActiveDto): Promise<AccountDto> {
    return this.accounts.setHostActive(hostId, dto.active);
  }

  @Patch('hosts/:hostId/subscription')
  setSubscription(@Param('hostId') hostId: string, @Body() dto: SetSubscriptionDto): Promise<AccountDto> {
    const given = [dto.extendMonths, dto.until, dto.forever].filter((value) => value !== undefined).length;
    if (given !== 1) throw new BadRequestException({ code: 'INVALID_SUBSCRIPTION', message: 'Send exactly one change' });
    if (dto.forever !== undefined) return this.accounts.setSubscription(hostId, { forever: dto.forever });
    if (dto.until !== undefined) return this.accounts.setSubscription(hostId, { until: dto.until });
    return this.accounts.setSubscription(hostId, { extendMonths: dto.extendMonths! });
  }

  @Get('teams')
  listTeams(): Promise<AdminTeamDto[]> {
    return this.teams.list();
  }

  @Patch('teams/:teamId')
  renameTeam(@Param('teamId') teamId: string, @Body() dto: RenameTeamDto) {
    return this.teams.rename(teamId, dto.name);
  }

  @Delete('teams/:teamId')
  @HttpCode(204)
  deleteTeam(@Param('teamId') teamId: string): Promise<void> {
    return this.teams.remove(teamId);
  }
}
