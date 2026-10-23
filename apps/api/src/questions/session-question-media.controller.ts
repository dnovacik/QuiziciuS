import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QuestionsRepository } from '../data/questions.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { SupabaseService } from '../supabase/supabase.service';

/** Links are valid this long… */
const SIGNED_URL_SECONDS = 15 * 60;
/** …and handed out again for this long, so every screen gets the same, browser-cacheable link. */
const REUSE_MS = 10 * 60 * 1000;

/**
 * Public session media access is limited to the CURRENT question, from its lock-in (so phones and
 * the projector can preload it before it is shown) until it is revealed.
 */
@Controller('sessions/:sessionId/media')
export class SessionQuestionMediaController {
  private readonly signed = new Map<string, { url: string; until: number }>();

  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly supabase: SupabaseService,
  ) {}

  @Get()
  async currentQuestionMedia(@Param('sessionId') sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session || !session.current_question_id || !['LOCK_IN_ROUND', 'QUESTION_ACTIVE', 'QUESTION_REVEAL'].includes(session.status))
      return { mediaType: null, url: null };
    const question = await this.questions.findById(session.current_question_id);
    const media = question?.quiz_id === session.quiz_id ? question.media : null;
    if (!media || media.source !== 'upload' || !media.path) return { mediaType: null, url: null };
    return { mediaType: media.kind, url: await this.signedUrl(media.path) };
  }

  private async signedUrl(path: string): Promise<string> {
    const cached = this.signed.get(path);
    if (cached && cached.until > Date.now()) return cached.url;
    const { data, error } = await this.supabase.getClient().storage.from('question-media').createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !data) throw new NotFoundException('Question media unavailable');
    this.signed.set(path, { url: data.signedUrl, until: Date.now() + REUSE_MS });
    return data.signedUrl;
  }
}
