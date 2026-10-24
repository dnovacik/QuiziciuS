import { canLaunchNights } from '../accounts/subscription';
import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { QuizzesRepository } from '../data/quizzes.repository';
import { LeaguesService } from '../leagues/leagues.service';
import { SessionsRepository } from '../data/sessions.repository';
import { PubsService } from '../pubs/pubs.service';
import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { AddPaperScoreDto } from './dto/add-paper-score.dto';
import { ControlTimerDto } from './dto/control-timer.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { TransitionSessionDto } from './dto/transition-session.dto';

@Controller()
export class SessionsController {
  constructor(
    private readonly quizEngine: QuizEngineService,
    private readonly quizzes: QuizzesRepository,
    private readonly sessions: SessionsRepository,
    private readonly pubs: PubsService,
    private readonly leagues: LeaguesService,
  ) {}

  @Post('quizzes/:quizId/sessions')
  @RequireRole('HOST')
  async create(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload, @Body() dto: CreateSessionDto = {}) {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== host.id) throw new ForbiddenException('Not your quiz');
    // A deactivated host keeps their quizzes and history but cannot run new quiz nights.
    if (host.deactivated) throw new ForbiddenException({ code: 'HOST_DEACTIVATED', message: 'This host account is deactivated' });
    // So does a host whose subscription has run out; a night already running always finishes.
    if (!canLaunchNights(host.subscription)) {
      throw new ForbiddenException({ code: 'SUBSCRIPTION_EXPIRED', message: 'The subscription has expired' });
    }
    const pubId = dto.pubId === undefined ? quiz.pub_id : dto.pubId;
    if (pubId) await this.pubs.requirePub(pubId);
    const leagueId = dto.leagueId ?? null;
    if (leagueId) await this.leagues.assertCanLaunch(host.id, leagueId, pubId);
    return this.quizEngine.createSession(quizId, host.id, pubId, leagueId);
  }

  @Get('host/sessions')
  @RequireRole('HOST')
  listHostSessions(@CurrentHost() host: CurrentHostPayload) {
    return this.sessions.listByHost(host.id);
  }

  @Get('host/sessions/:sessionId')
  @RequireRole('HOST')
  async hostSession(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload) {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.host_id !== host.id) throw new ForbiddenException('Not your session');
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
  async displayMetadata(@Param('sessionId') sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    const quiz = await this.quizzes.findById(session.quiz_id);
    if (!quiz) throw new NotFoundException('Quiz not found');
    const pub = session.pub_id ? await this.pubs.requirePub(session.pub_id).catch(() => null) : null;
    const league = session.league_id ? await this.leagues.publicInfo(session.league_id) : null;
    return { title: quiz.title, quizId: quiz.id, pub: pub && { id: pub.id, name: pub.name, city: pub.city }, league };
  }

  @Get('sessions/:sessionId/state')
  getState(@Param('sessionId') sessionId: string) {
    return this.quizEngine.getState(sessionId);
  }

  @Post('sessions/:sessionId/transition')
  @RequireRole('HOST')
  transition(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload, @Body() dto: TransitionSessionDto) {
    return this.quizEngine.transitionState(sessionId, host.id, dto.status, {
      questionId: dto.questionId,
      breakMinutes: dto.breakMinutes,
      breakMessage: dto.breakMessage,
    });
  }

  @Post('sessions/:sessionId/timer')
  @RequireRole('HOST')
  controlTimer(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload, @Body() dto: ControlTimerDto) {
    return this.quizEngine.controlTimer(sessionId, host.id, dto.action, dto.seconds);
  }

  @Post('sessions/:sessionId/close-answers')
  @RequireRole('HOST')
  closeAnswers(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload) {
    return this.quizEngine.closeAnswers(sessionId, host.id);
  }

  @Post('answers/:answerId/resolve-dispute')
  @RequireRole('HOST')
  resolveDispute(@Param('answerId') answerId: string, @CurrentHost() host: CurrentHostPayload, @Body() dto: ResolveDisputeDto) {
    return this.quizEngine.resolveDispute(answerId, host.id, dto.decision);
  }

  @Post('sessions/:sessionId/teams/:teamId/paper-score')
  @RequireRole('HOST')
  addPaperScore(
    @Param('sessionId') sessionId: string,
    @Param('teamId') teamId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: AddPaperScoreDto,
  ) {
    return this.quizEngine.addPaperScore(sessionId, host.id, teamId, dto.points, dto.reason ?? null);
  }

  @Get('sessions/:sessionId/disputes')
  @RequireRole('HOST')
  listDisputes(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload) {
    return this.quizEngine.listDisputes(sessionId, host.id);
  }

  @Get('host/sessions/:sessionId/answers')
  @RequireRole('HOST')
  listAnswers(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload, @Query('questionId') questionId?: string) {
    return this.quizEngine.listAnswers(sessionId, host.id, questionId);
  }
}
