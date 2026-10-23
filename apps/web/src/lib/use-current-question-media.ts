import { useEffect, useState } from 'react';
import type { QuizState, ResolvedMediaDto } from '@quizicius/shared-types';
import { apiGet } from './api-client';
import { loadYouTubeApi } from './youtube';

/** What the server serves for the current question: reveal media only at the reveal. */
export interface QuestionMedia {
  media: ResolvedMediaDto | null;
  revealMedia: ResolvedMediaDto | null;
}
/** Answering and lock-in ask for the question media; the reveal asks again for the reveal media. */
type Phase = 'question' | 'reveal';

/** The server hands out the same signed link for 10 minutes; ask again after that. */
const FRESH_MS = 9 * 60 * 1000;
const cache = new Map<string, { media: QuestionMedia; at: number }>();
const pending = new Map<string, Promise<QuestionMedia>>();

const keyOf = (sessionId: string, questionId: string, phase: Phase) => `${sessionId}:${questionId}:${phase}`;
const phaseOf = (status: QuizState | undefined): Phase => (status === 'QUESTION_REVEAL' ? 'reveal' : 'question');

/** Test helper: forget every loaded question. */
export function clearQuestionMediaCache(): void {
  cache.clear();
  pending.clear();
}

function cached(key: string): QuestionMedia | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < FRESH_MS ? hit.media : null;
}

/**
 * Starts the browser download, so showing the media later is instant (served from its cache).
 * Phones only ever show images; the projector also warms audio and video files and loads YouTube's player.
 */
function warm(media: ResolvedMediaDto | null, clips: boolean): void {
  if (!media) return;
  if (media.kind === 'image') {
    const image = new Image();
    image.src = media.url;
  } else if (clips && media.kind === 'youtube') {
    void loadYouTubeApi().catch(() => undefined);
  } else if (clips && (media.kind === 'audio' || media.kind === 'video')) {
    // Only the start of the file: the projector's own player then downloads the rest, once.
    const element = document.createElement(media.kind);
    element.preload = 'metadata';
    element.muted = true;
    element.src = media.url;
    element.load();
  }
}

/** One request per question and phase, shared by every component that asks. */
function loadMedia(sessionId: string, questionId: string, phase: Phase, clips = false): Promise<QuestionMedia> {
  const key = keyOf(sessionId, questionId, phase);
  const hit = cached(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const request = apiGet<QuestionMedia>(`/sessions/${sessionId}/media`)
    .then((served) => {
      // Only keep a question that actually had something to show; an empty answer may just
      // mean the question was not unlocked yet.
      if (served.media || served.revealMedia) {
        cache.set(key, { media: served, at: Date.now() });
        warm(phase === 'reveal' ? served.revealMedia : served.media, clips);
      }
      return served;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

/**
 * During the lock-in the next question is already chosen but not shown: fetch its media link and
 * start downloading the file, so it appears without a gap. Used by screens that stay mounted
 * through the whole night (player game, projector); `clips` also downloads audio and video.
 */
export function usePreloadQuestionMedia(
  sessionId: string | undefined,
  questionId: string | undefined,
  status: QuizState | undefined,
  { clips = false }: { clips?: boolean } = {},
): void {
  useEffect(() => {
    if (!sessionId || !questionId || status !== 'LOCK_IN_ROUND') return;
    loadMedia(sessionId, questionId, 'question', clips).catch(() => {
      // Preloading is best effort; the question screen asks again.
    });
  }, [sessionId, questionId, status, clips]);
}

/**
 * The current question's media while it is on screen (answering and reveal), and its reveal media
 * at the reveal. The question media is kept through the reveal, so the reveal does not reload it;
 * preloaded media shows on the first render.
 */
export function useCurrentQuestionMedia(
  sessionId: string | undefined,
  questionId: string | undefined,
  status: QuizState | undefined,
): QuestionMedia & { error: string | null } {
  const visible = status === 'QUESTION_ACTIVE' || status === 'QUESTION_REVEAL';
  const phase = phaseOf(status);
  const key = sessionId && questionId ? keyOf(sessionId, questionId, phase) : null;
  const [loaded, setLoaded] = useState<{ key: string; media: QuestionMedia } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!visible || !sessionId || !questionId || !key) return;
    if (cached(key)) return;
    let active = true;
    loadMedia(sessionId, questionId, phase)
      .then((media) => {
        if (active) setLoaded({ key, media });
      })
      .catch((err: unknown) => {
        if (active) setError({ key, message: err instanceof Error ? err.message : 'Media unavailable' });
      });
    return () => {
      active = false;
    };
  }, [visible, sessionId, questionId, key, phase]);

  if (!visible || !key) return { media: null, revealMedia: null, error: null };
  const current = cached(key) ?? (loaded?.key === key ? loaded.media : null);
  // While the reveal is loading, keep showing what the question showed.
  const earlier = phase === 'reveal' ? cached(keyOf(sessionId!, questionId!, 'question')) : null;
  return {
    media: current?.media ?? earlier?.media ?? null,
    revealMedia: current?.revealMedia ?? null,
    error: error?.key === key ? error.message : null,
  };
}
