import { useEffect, useState } from 'react';
import type { QuizState } from '@quizicius/shared-types';
import { apiGet } from './api-client';

export interface QuestionMedia {
  mediaType: 'image' | 'video' | null;
  url: string | null;
}

/** Signed URL for the current question's image/video; only requested while the question is on screen. */
export function useCurrentQuestionMedia(
  sessionId: string | undefined,
  questionId: string | undefined,
  status: QuizState | undefined,
): { media: QuestionMedia | null; error: string | null } {
  const [media, setMedia] = useState<QuestionMedia | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMedia(null);
    setError(null);
    if (!sessionId || !questionId || (status !== 'QUESTION_ACTIVE' && status !== 'QUESTION_REVEAL')) return;

    let active = true;
    apiGet<QuestionMedia>(`/sessions/${sessionId}/media`)
      .then((row) => {
        if (active) setMedia(row);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Media unavailable');
      });
    return () => {
      active = false;
    };
  }, [sessionId, questionId, status]);

  return { media, error };
}
