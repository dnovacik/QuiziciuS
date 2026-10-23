import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { SessionsRepository } from '../data/sessions.repository';
import { QuestionsRepository } from '../data/questions.repository';
import { SupabaseService } from '../supabase/supabase.service';

/** Public session media access is limited to the CURRENT active/revealed question. */
@Controller('sessions/:sessionId/media')
export class SessionQuestionMediaController {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly supabase: SupabaseService,
  ) {}

  @Get()
  async currentQuestionMedia(@Param('sessionId') sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session || !session.current_question_id || !['QUESTION_ACTIVE', 'QUESTION_REVEAL'].includes(session.status))
      return { mediaType: null, url: null };
    const question = await this.questions.findById(session.current_question_id);
    if (!question || question.quiz_id !== session.quiz_id || !question.media_path || !question.media_type)
      return { mediaType: null, url: null };
    const { data, error } = await this.supabase
      .getClient()
      .storage.from('question-media')
      .createSignedUrl(question.media_path, 15 * 60);
    if (error || !data) throw new NotFoundException('Question media unavailable');
    return { mediaType: question.media_type, url: data.signedUrl };
  }
}
