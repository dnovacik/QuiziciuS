import { Body, Controller, Param, Post } from '@nestjs/common';
import { JoinTeamDto } from './dto/join-team.dto';
import { JoinResult, TeamsService } from './teams.service';

@Controller('sessions/:sessionId/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post('join')
  join(@Param('sessionId') sessionId: string, @Body() dto: JoinTeamDto): Promise<JoinResult> {
    return this.teams.join(sessionId, dto.name);
  }
}
