import { useEffect, useState } from 'react';
import { apiGet } from './api-client';

/** Public quiz title for a session (safe for players and projectors). */
export function useQuizTitle(sessionId: string | undefined): string | null {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    setTitle(null);
    if (!sessionId) return;
    let active = true;
    apiGet<{ title: string }>(`/sessions/${sessionId}/display`)
      .then((row) => {
        if (active) setTitle(row.title);
      })
      .catch(() => {
        // The title is decoration; screens fall back to a generic label.
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  return title;
}
