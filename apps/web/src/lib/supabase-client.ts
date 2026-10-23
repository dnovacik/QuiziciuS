import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);

export type SessionBroadcastEvent = 'STATE_CHANGE' | 'SCORE_UPDATE';

export function subscribeToSession(
  sessionId: string,
  onEvent: (event: SessionBroadcastEvent, payload: Record<string, unknown>) => void,
): () => void {
  const channel = supabase.channel(`quiz:${sessionId}`);
  channel
    .on('broadcast', { event: 'STATE_CHANGE' }, ({ payload }) => onEvent('STATE_CHANGE', payload))
    .on('broadcast', { event: 'SCORE_UPDATE' }, ({ payload }) => onEvent('SCORE_UPDATE', payload))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
