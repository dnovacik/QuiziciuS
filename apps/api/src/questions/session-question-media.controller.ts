import { Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { MediaRefDto, MediaSlot, QuizState, ResolvedMediaDto } from '@quizicius/shared-types';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { QuestionsRepository } from '../data/questions.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MediaControlDto } from './dto/media-control.dto';

/** Links are valid this long… */
const SIGNED_URL_SECONDS = 15 * 60;
/** …and handed out again for this long, so every screen gets the same, browser-cacheable link. */
const REUSE_MS = 10 * 60 * 1000;

/** When each slot of the current question may be served. Reveal media must never leak the answer early. */
const SERVED_IN: Record<MediaSlot, QuizState[]> = {
  question: ['LOCK_IN_ROUND', 'QUESTION_ACTIVE', 'QUESTION_REVEAL'],
  reveal: ['QUESTION_REVEAL'],
};
/** When the host may play each slot on the projector. */
const PLAYABLE_IN: Record<MediaSlot, QuizState[]> = {
  question: ['QUESTION_ACTIVE', 'QUESTION_REVEAL'],
  reveal: ['QUESTION_REVEAL'],
};

const notAvailable = () => new ConflictException({ code: 'MEDIA_NOT_AVAILABLE', message: 'This media cannot be played now' });

/**
 * Public session media access is limited to the CURRENT question, from its lock-in (so phones and
 * the projector can preload it before it is shown) until it is revealed. The host controls playback
 * on the projector through realtime MEDIA_CONTROL messages.
 */
@Controller('sessions/:sessionId/media')
export class SessionQuestionMediaController {
  private readonly signed = new Map<string, { url: string; until: number }>();

  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly supabase: SupabaseService,
    private readonly realtime: RealtimeBroadcastService,
  ) {}

  @Get()
  async currentQuestionMedia(
    @Param('sessionId') sessionId: string,
  ): Promise<{ media: ResolvedMediaDto | null; revealMedia: ResolvedMediaDto | null }> {
    const none = { media: null, revealMedia: null };
    const session = await this.sessions.findById(sessionId);
    if (!session || !session.current_question_id || !SERVED_IN.question.includes(session.status)) return none;
    const question = await this.questions.findById(session.current_question_id);
    if (!question || question.quiz_id !== session.quiz_id) return none;
    return {
      media: await this.resolve(question.media),
      revealMedia: SERVED_IN.reveal.includes(session.status) ? await this.resolve(question.reveal_media) : null,
    };
  }

  @Post('control')
  @RequireRole('HOST')
  async control(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload, @Body() dto: MediaControlDto) {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.host_id !== host.id) throw new ForbiddenException('Not your session');
    if (!session.current_question_id || !PLAYABLE_IN[dto.slot].includes(session.status)) throw notAvailable();
    const question = await this.questions.findById(session.current_question_id);
    const ref = dto.slot === 'question' ? question?.media : question?.reveal_media;
    if (!ref) throw notAvailable();
    await this.realtime.publish(sessionId, 'MEDIA_CONTROL', {
      questionId: question!.id,
      slot: dto.slot,
      action: dto.action,
      at: Date.now(),
    });
    return { ok: true };
  }

  private async resolve(ref: MediaRefDto | null | undefined): Promise<ResolvedMediaDto | null> {
    const url = ref?.source === 'upload' && ref.path ? await this.signedUrl(ref.path) : ref?.url;
    if (!ref || !url) return null;
    return { kind: ref.kind, url, startSeconds: ref.startSeconds ?? null, durationSeconds: ref.durationSeconds ?? null };
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
