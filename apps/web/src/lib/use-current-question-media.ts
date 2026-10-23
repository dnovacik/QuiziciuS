import { useEffect, useState } from 'react';
import type { QuizState } from '@quizicius/shared-types';
import { apiGet } from './api-client';

export interface QuestionMedia {
  mediaType: 'image' | 'video' | null;
  url: string | null;
}

/** The server hands out the same signed link for 10 minutes; ask again after that. */
const FRESH_MS = 9 * 60 * 1000;
const cache = new Map<string, { media: QuestionMedia; at: number }>();
const pending = new Map<string, Promise<QuestionMedia>>();

const keyOf = (sessionId: string, questionId: string) => `${sessionId}:${questionId}`;

/** Test helper: forget every loaded question. */
export function clearQuestionMediaCache(): void {
  cache.clear();
  pending.clear();
}

function cached(key: string): QuestionMedia | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < FRESH_MS ? hit.media : null;
}

/** Starts the browser download, so showing the media later is instant (served from its cache). */
function warm(media: QuestionMedia): void {
  if (!media.url) return;
  if (media.mediaType === 'image') {
    const image = new Image();
    image.src = media.url;
  } else if (media.mediaType === 'video') {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = media.url;
    video.load();
  }
}

/** One request per question, shared by every component that asks. */
function loadMedia(sessionId: string, questionId: string): Promise<QuestionMedia> {
  const key = keyOf(sessionId, questionId);
  const hit = cached(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const request = apiGet<QuestionMedia>(`/sessions/${sessionId}/media`)
    .then((media) => {
      // Only keep a question that actually had something to show; an empty answer may just
      // mean the question was not unlocked yet.
      if (media.url) {
        cache.set(key, { media, at: Date.now() });
        warm(media);
      }
      return media;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

/**
 * During the lock-in the next question is already chosen but not shown: fetch its media link and
 * start downloading the file, so it appears without a gap. Used by screens that stay mounted
 * through the whole night (player game, projector).
 */
export function usePreloadQuestionMedia(
  sessionId: string | undefined,
  questionId: string | undefined,
  status: QuizState | undefined,
): void {
  useEffect(() => {
    if (!sessionId || !questionId || status !== 'LOCK_IN_ROUND') return;
    loadMedia(sessionId, questionId).catch(() => {
      // Preloading is best effort; the question screen asks again.
    });
  }, [sessionId, questionId, status]);
}

/**
 * The current question's image/video while it is on screen (answering and reveal). Kept for the
 * whole question, so the reveal does not reload it; preloaded media shows on the first render.
 */
export function useCurrentQuestionMedia(
  sessionId: string | undefined,
  questionId: string | undefined,
  status: QuizState | undefined,
): { media: QuestionMedia | null; error: string | null } {
  const visible = status === 'QUESTION_ACTIVE' || status === 'QUESTION_REVEAL';
  const key = sessionId && questionId ? keyOf(sessionId, questionId) : null;
  const [loaded, setLoaded] = useState<{ key: string; media: QuestionMedia } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!visible || !sessionId || !questionId || !key) return;
    if (cached(key)) return;
    let active = true;
    loadMedia(sessionId, questionId)
      .then((media) => {
        if (active) setLoaded({ key, media });
      })
      .catch((err: unknown) => {
        if (active) setError({ key, message: err instanceof Error ? err.message : 'Media unavailable' });
      });
    return () => {
      active = false;
    };
  }, [visible, sessionId, questionId, key]);

  if (!visible || !key) return { media: null, error: null };
  const media = cached(key) ?? (loaded?.key === key ? loaded.media : null);
  return { media, error: error?.key === key ? error.message : null };
}
