import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentTeam } from '../teams/current-team.decorator';
import { TeamTokenGuard } from '../teams/team-token.guard';
import { TeamTokenPayload } from '../teams/team-token.service';
import { ReportInfractionDto } from './dto/report-infraction.dto';
import { InfractionsService } from './infractions.service';

@Controller()
export class InfractionsController {
  constructor(private readonly infractions: InfractionsService) {}

  @Post('api/infractions/report')
  @UseGuards(TeamTokenGuard)
  report(@CurrentTeam() team: TeamTokenPayload, @Body() dto: ReportInfractionDto) {
    return this.infractions.report(team.sessionId, team.teamId, dto.type);
  }

  @Get('sessions/:sessionId/infractions')
  @UseGuards(SupabaseAuthGuard)
  list(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload) {
    return this.infractions.listForHost(sessionId, host.id);
  }
}
