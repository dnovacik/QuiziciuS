import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AnswerSummaryDto } from '@quizicius/shared-types';
import { CurrentTeam } from '../teams/current-team.decorator';
import { TeamTokenGuard } from '../teams/team-token.guard';
import { TeamTokenPayload } from '../teams/team-token.service';
import { AnswersService } from './answers.service';
import { DisputeAnswerDto } from './dto/dispute-answer.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Controller('sessions/:sessionId/answers')
@UseGuards(TeamTokenGuard)
export class AnswersController {
  constructor(private readonly answers: AnswersService) {}

  @Post()
  submit(
    @Param('sessionId') sessionId: string,
    @CurrentTeam() team: TeamTokenPayload,
    @Body() dto: SubmitAnswerDto,
  ): Promise<AnswerSummaryDto> {
    if (team.sessionId !== sessionId) {
      throw new ForbiddenException('Token does not match this session');
    }
    return this.answers.submit(sessionId, team.teamId, dto.questionId, dto.response);
  }

  /** The team disputes its own graded answer; the host decides in the review queue. */
  @Post(':answerId/dispute')
  dispute(
    @Param('sessionId') sessionId: string,
    @Param('answerId') answerId: string,
    @CurrentTeam() team: TeamTokenPayload,
    @Body() dto: DisputeAnswerDto,
  ): Promise<AnswerSummaryDto> {
    if (team.sessionId !== sessionId) {
      throw new ForbiddenException('Token does not match this session');
    }
    return this.answers.dispute(sessionId, team.teamId, answerId, dto.note ?? null);
  }

  @Get('mine')
  listMine(@Param('sessionId') sessionId: string, @CurrentTeam() team: TeamTokenPayload): Promise<AnswerSummaryDto[]> {
    if (team.sessionId !== sessionId) {
      throw new ForbiddenException('Token does not match this session');
    }
    return this.answers.listForTeam(sessionId, team.teamId);
  }
}
