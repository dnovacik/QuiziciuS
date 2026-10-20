import { QuizSessionStateDto } from '@quizicius/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from './api-client';
import { subscribeToSession } from './supabase-client';

export function useSessionState(sessionId: string | undefined): {
  state: QuizSessionStateDto | null;
  error: string | null;
  refetch: () => void;
} {
  const [state, setState] = useState<QuizSessionStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!sessionId) return;
    apiGet<QuizSessionStateDto>(`/sessions/${sessionId}/state`)
      .then(setState)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load session'));
  }, [sessionId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToSession(sessionId, () => refetch());
  }, [sessionId, refetch]);

  return { state, error, refetch };
}
