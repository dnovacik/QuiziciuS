import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AccountDto } from '@quizicius/shared-types';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { AccountsService, AdminHostDto } from './accounts.service';
import { AdminTeamDto, AdminTeamsService } from './admin-teams.service';
import { RenameTeamDto, SetHostActiveDto } from './dto/admin-patch.dto';
import { InviteHostDto } from './dto/invite-host.dto';

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  /** The signed-in account and its role; the web app routes on this. */
  @Get('me')
  @RequireRole('TEAM_CAPTAIN')
  me(@CurrentHost() account: CurrentHostPayload): Promise<AccountDto> {
    return this.accounts.me(account.id);
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
