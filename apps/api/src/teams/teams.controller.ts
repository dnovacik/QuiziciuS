import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentTeam } from './current-team.decorator';
import { JoinTeamDto } from './dto/join-team.dto';
import { TeamReadyDto } from './dto/team-ready.dto';
import { TeamTokenGuard } from './team-token.guard';
import { TeamTokenPayload } from './team-token.service';
import { JoinResult, TeamsService } from './teams.service';

@Controller('sessions/:sessionId/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post('join')
  join(@Param('sessionId') sessionId: string, @Body() dto: JoinTeamDto): Promise<JoinResult> {
    return this.teams.join(sessionId, dto.name);
  }

  @Post('me/ready')
  @UseGuards(TeamTokenGuard)
  ready(@Param('sessionId') sessionId: string, @CurrentTeam() team: TeamTokenPayload, @Body() dto: TeamReadyDto): Promise<{ ready: true }> {
    if (team.sessionId !== sessionId) {
      throw new ForbiddenException('Token does not match this session');
    }
    return this.teams.markReady(sessionId, team.teamId, dto.fullscreen);
  }
}
