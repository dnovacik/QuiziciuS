import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { QuizzesRepository } from '../data/quizzes.repository';
import { CreateQuestionDto } from './dto/create-question.dto';
import { normalizeMediaRef } from './media-ref';

const MB = 1024 * 1024;
const UPLOADS: Record<string, { ext: string; type: 'image' | 'video' | 'audio'; max: number }> = {
  'image/jpeg': { ext: 'jpg', type: 'image', max: 10 * MB },
  'image/png': { ext: 'png', type: 'image', max: 10 * MB },
  'image/webp': { ext: 'webp', type: 'image', max: 10 * MB },
  'video/mp4': { ext: 'mp4', type: 'video', max: 100 * MB },
  'video/webm': { ext: 'webm', type: 'video', max: 100 * MB },
  'audio/mpeg': { ext: 'mp3', type: 'audio', max: 25 * MB },
  'audio/mp4': { ext: 'm4a', type: 'audio', max: 25 * MB },
  'audio/ogg': { ext: 'ogg', type: 'audio', max: 25 * MB },
  'audio/wav': { ext: 'wav', type: 'audio', max: 25 * MB },
};

@Controller('quizzes/:quizId/questions')
@RequireRole('HOST')
export class QuestionsController {
  constructor(
    private readonly quizzes: QuizzesRepository,
    private readonly questions: QuestionsRepository,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('media/upload-url')
  async createMediaUpload(
    @Param('quizId') quizId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() body: { mimeType?: string; fileSize?: number },
  ) {
    await this.requireOwnedQuiz(quizId, host.id);
    const policy = body.mimeType && UPLOADS[body.mimeType];
    if (!policy || !Number.isSafeInteger(body.fileSize) || body.fileSize! > policy.max || body.fileSize! <= 0)
      throw new BadRequestException('Unsupported media type or file size');
    const path = `${host.id}/${quizId}/${randomUUID()}.${policy.ext}`;
    const { data, error } = await this.supabase.getClient().storage.from('question-media').createSignedUploadUrl(path);
    if (error || !data) throw new BadRequestException(error?.message ?? 'Unable to initiate upload');
    return { path, token: data.token, mediaType: policy.type };
  }

  @Get('media/url')
  async mediaUrl(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload, @Query('path') path: string) {
    await this.requireOwnedQuiz(quizId, host.id);
    if (!path?.startsWith(`${host.id}/${quizId}/`) || path.includes('..'))
      throw new ForbiddenException('Media does not belong to this quiz');
    const { data, error } = await this.supabase
      .getClient()
      .storage.from('question-media')
      .createSignedUrl(path, 60 * 15);
    if (error || !data) throw new NotFoundException('Media not found');
    return { url: data.signedUrl };
  }
  @Post()
  async create(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload, @Body() dto: CreateQuestionDto) {
    await this.requireOwnedQuiz(quizId, host.id);
    return this.questions.create(quizId, this.toRecord(dto, host.id, quizId));
  }

  @Get()
  async list(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload) {
    await this.requireOwnedQuiz(quizId, host.id);
    return this.questions.listByQuiz(quizId);
  }

  @Patch(':questionId')
  async update(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: CreateQuestionDto,
  ) {
    await this.requireOwnedQuiz(quizId, host.id);
    const updated = await this.questions.update(quizId, questionId, this.toRecord(dto, host.id, quizId));
    if (!updated) throw new NotFoundException('Question not found');
    return updated;
  }
  @Delete(':questionId')
  async remove(@Param('quizId') quizId: string, @Param('questionId') questionId: string, @CurrentHost() host: CurrentHostPayload) {
    await this.requireOwnedQuiz(quizId, host.id);
    if (!(await this.questions.remove(quizId, questionId))) throw new NotFoundException('Question not found');
    return { deleted: true };
  }
  /** Throws INVALID_MEDIA, before anything is stored, when either media slot is invalid. */
  private toRecord(dto: CreateQuestionDto, hostId: string, quizId: string): Omit<QuestionRecord, 'id' | 'quiz_id'> {
    return {
      type: dto.type,
      media: normalizeMediaRef(dto.media, hostId, quizId),
      reveal_media: normalizeMediaRef(dto.revealMedia, hostId, quizId),
      prompt: dto.prompt,
      options: dto.options ?? null,
      accepted_answers: dto.acceptedAnswers ?? null,
      correct_numeric: dto.correctNumeric ?? null,
      points: dto.points ?? 1,
      time_limit_seconds: dto.timeLimitSeconds ?? 30,
      order_index: dto.orderIndex,
    };
  }
  private async requireOwnedQuiz(quizId: string, hostId: string): Promise<void> {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== hostId) throw new ForbiddenException('Not your quiz');
  }
}
