import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuizzesRepository } from '../data/quizzes.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { AddPaperScoreDto } from './dto/add-paper-score.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { TransitionSessionDto } from './dto/transition-session.dto';

@Controller()
export class SessionsController {
  constructor(
    private readonly quizEngine: QuizEngineService,
    private readonly quizzes: QuizzesRepository,
    private readonly sessions: SessionsRepository,
  ) {}

  @Post('quizzes/:quizId/sessions')
  @UseGuards(SupabaseAuthGuard)
  async create(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload) {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== host.id) throw new ForbiddenException('Not your quiz');
    return this.quizEngine.createSession(quizId, host.id);
  }

  @Get('host/sessions')
  @UseGuards(SupabaseAuthGuard)
  listHostSessions(@CurrentHost() host:CurrentHostPayload){
    return this.sessions.listByHost(host.id);
  }

  @Get('host/sessions/:sessionId')
  @UseGuards(SupabaseAuthGuard)
  async hostSession(@Param('sessionId') sessionId:string,@CurrentHost() host:CurrentHostPayload){
    const session=await this.sessions.findById(sessionId);
    if(!session)throw new NotFoundException('Session not found');
    if(session.host_id!==host.id)throw new ForbiddenException('Not your session');
    return session;
  }

  // Public, like GET /sessions/:sessionId/state: players type the spoken-aloud join
  // code before they have any credentials. Returns only the session id — everything
  // else still has to be fetched through the normal (also public) state endpoint.
  @Get('sessions/by-code/:code')
  async findByJoinCode(@Param('code') code: string): Promise<{ id: string }> {
    const session = await this.sessions.findByJoinCode(code.trim().toUpperCase());
    if (!session) throw new NotFoundException('No open session with that join code');
    return { id: session.id };
  }

  // Public display metadata: safe to share with projectors, never includes host credentials.
  @Get('sessions/:sessionId/display')
  async displayMetadata(@Param('sessionId') sessionId:string) {
    const session=await this.sessions.findById(sessionId);
    if(!session)throw new NotFoundException('Session not found');
    const quiz=await this.quizzes.findById(session.quiz_id);
    if(!quiz)throw new NotFoundException('Quiz not found');
    return { title:quiz.title, quizId:quiz.id };
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
