import { useEffect, useState } from 'react';
import { apiGet } from './api-client';
import { pubLabel, type Pub } from './pubs';

export interface SessionDisplay {
  title: string | null;
  /** "Pub, City" the session is played at, when the host picked one. */
  pub: string | null;
  /** The league this night counts for, if the host ticked one. */
  league: { id: string; name: string } | null;
}

/** Public quiz title and pub for a session (safe for players and projectors). */
export function useSessionDisplay(sessionId: string | undefined): SessionDisplay {
  const [display, setDisplay] = useState<SessionDisplay>({ title: null, pub: null, league: null });

  useEffect(() => {
    setDisplay({ title: null, pub: null, league: null });
    if (!sessionId) return;
    let active = true;
    apiGet<{ title: string; pub?: Pub | null; league?: { id: string; name: string } | null }>(`/sessions/${sessionId}/display`)
      .then((row) => {
        if (active) setDisplay({ title: row.title, pub: row.pub ? pubLabel(row.pub) : null, league: row.league ?? null });
      })
      .catch(() => {
        // The title is decoration; screens fall back to a generic label.
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  return display;
}

export function useQuizTitle(sessionId: string | undefined): string | null {
  return useSessionDisplay(sessionId).title;
}
