import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuizzesRepository } from '../data/quizzes.repository';
import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { AddPaperScoreDto } from './dto/add-paper-score.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { TransitionSessionDto } from './dto/transition-session.dto';

@Controller()
export class SessionsController {
  constructor(
    private readonly quizEngine: QuizEngineService,
    private readonly quizzes: QuizzesRepository,
  ) {}

  @Post('quizzes/:quizId/sessions')
  @UseGuards(SupabaseAuthGuard)
  async create(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload) {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== host.id) throw new ForbiddenException('Not your quiz');
    return this.quizEngine.createSession(quizId, host.id);
  }

  @Get('sessions/:sessionId/state')
  getState(@Param('sessionId') sessionId: string) {
    return this.quizEngine.getState(sessionId);
  }

  @Post('sessions/:sessionId/transition')
  @UseGuards(SupabaseAuthGuard)
  transition(
    @Param('sessionId') sessionId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: TransitionSessionDto,
  ) {
    return this.quizEngine.transitionState(sessionId, host.id, dto.status, { questionId: dto.questionId });
  }

  @Post('answers/:answerId/resolve-dispute')
  @UseGuards(SupabaseAuthGuard)
  resolveDispute(
    @Param('answerId') answerId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.quizEngine.resolveDispute(answerId, host.id, dto.decision);
  }

  @Post('sessions/:sessionId/teams/:teamId/paper-score')
  @UseGuards(SupabaseAuthGuard)
  addPaperScore(
    @Param('sessionId') sessionId: string,
    @Param('teamId') teamId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: AddPaperScoreDto,
  ) {
    return this.quizEngine.addPaperScore(sessionId, host.id, teamId, dto.points, dto.reason ?? null);
  }

  @Get('sessions/:sessionId/disputes')
  @UseGuards(SupabaseAuthGuard)
  listDisputes(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload) {
    return this.quizEngine.listDisputes(sessionId, host.id);
  }
}
