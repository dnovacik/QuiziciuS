import { QuizSessionStateDto } from '@quizicius/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from './api-client';
import { subscribeToSession } from './supabase-client';

/** A safety net for updates that never arrived (a dropped realtime message, a flaky pub Wi-Fi). */
const RECHECK_MS = 15_000;

export function useSessionState(sessionId: string | undefined): {
  state: QuizSessionStateDto | null;
  error: string | null;
  refetch: () => void;
} {
  const [state, setState] = useState<QuizSessionStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may update the screen; an older, slower reply is stale.
  const latest = useRef(0);

  const refetch = useCallback(() => {
    if (!sessionId) return;
    const request = ++latest.current;
    apiGet<QuizSessionStateDto>(`/sessions/${sessionId}/state`)
      .then((next) => {
        if (request !== latest.current) return;
        setState(next);
        setError(null);
      })
      .catch((err) => {
        if (request === latest.current) setError(err instanceof Error ? err.message : 'Failed to load session');
      });
  }, [sessionId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToSession(sessionId, () => refetch());
  }, [sessionId, refetch]);

  // A phone that slept or lost the network may have missed updates: catch up when it is back.
  useEffect(() => {
    if (!sessionId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refetch);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refetch();
    }, RECHECK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refetch);
      window.clearInterval(timer);
    };
  }, [sessionId, refetch]);

  return { state, error, refetch };
}
