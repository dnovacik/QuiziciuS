import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { QuizPatch, QuizRecord, QuizzesRepository } from '../data/quizzes.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { PubsService } from '../pubs/pubs.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';

@Controller('quizzes')
@RequireRole('HOST')
export class QuizzesController {
  constructor(
    private readonly quizzes: QuizzesRepository,
    private readonly sessions: SessionsRepository,
    private readonly pubs: PubsService,
  ) {}

  @Post()
  async create(@CurrentHost() host: CurrentHostPayload, @Body() dto: CreateQuizDto) {
    if (dto.pubId) await this.pubs.requirePub(dto.pubId);
    return this.quizzes.create(host.id, dto.title, dto.categoryId ?? null, dto.pubId ?? null);
  }

  @Get()
  list(@CurrentHost() host: CurrentHostPayload) {
    return this.quizzes.listByHost(host.id);
  }

  @Patch(':quizId')
  async update(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload, @Body() dto: UpdateQuizDto) {
    await this.requireOwnedQuiz(quizId, host.id);
    const patch: QuizPatch = {};
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.categoryId !== undefined) patch.category_id = dto.categoryId;
    if (dto.pubId) await this.pubs.requirePub(dto.pubId);
    if (dto.pubId !== undefined) patch.pub_id = dto.pubId;
    if (dto.defaultTimeLimitSeconds !== undefined) patch.default_time_limit_seconds = dto.defaultTimeLimitSeconds;
    return this.quizzes.update(quizId, patch);
  }

  /** Deleting cascades to past sessions, so a quiz that is being played right now is refused. */
  @Delete(':quizId')
  @HttpCode(204)
  async remove(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload): Promise<void> {
    await this.requireOwnedQuiz(quizId, host.id);
    const sessions = await this.sessions.listByHost(host.id);
    if (sessions.some((session) => session.quiz_id === quizId && session.status !== 'FINISHED')) {
      throw new ConflictException({ code: 'QUIZ_IN_PLAY', message: 'The quiz has a session in progress' });
    }
    await this.quizzes.remove(quizId);
  }

  private async requireOwnedQuiz(quizId: string, hostId: string): Promise<QuizRecord> {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== hostId) throw new ForbiddenException('Not your quiz');
    return quiz;
  }
}
