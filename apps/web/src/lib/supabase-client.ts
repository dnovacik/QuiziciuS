import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const PASSWORD_NEEDED_KEY = 'quizicius:set-password';

// Invite and password-recovery links sign the user in through the URL hash
// (#access_token=…&type=invite|recovery). supabase-js consumes and clears the hash when the
// client is created, so remember that a new password is needed before that happens.
if (typeof window !== 'undefined') {
  const linkType = new URLSearchParams(window.location.hash.slice(1)).get('type');
  if (linkType === 'invite' || linkType === 'recovery') {
    try {
      sessionStorage.setItem(PASSWORD_NEEDED_KEY, linkType);
    } catch {
      /* storage can be disabled; the user can still use "forgot password" later */
    }
  }
}

/** 'invite' or 'recovery' while the user arrived from such a link and has not set a password yet. */
export function pendingPasswordLink(): 'invite' | 'recovery' | null {
  try {
    const value = sessionStorage.getItem(PASSWORD_NEEDED_KEY);
    return value === 'invite' || value === 'recovery' ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingPasswordLink(): void {
  try {
    sessionStorage.removeItem(PASSWORD_NEEDED_KEY);
  } catch {
    /* nothing to clear */
  }
}

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);

export type SessionBroadcastEvent = 'STATE_CHANGE' | 'SCORE_UPDATE' | 'MEDIA_CONTROL' | 'MEDIA_STATUS';
type Listener = { events: SessionBroadcastEvent[]; onEvent: (event: SessionBroadcastEvent, payload: Record<string, unknown>) => void };

const EVENTS: SessionBroadcastEvent[] = ['STATE_CHANGE', 'SCORE_UPDATE', 'MEDIA_CONTROL', 'MEDIA_STATUS'];
/** One realtime channel per session, shared by everything on the page that listens or sends. */
const channels = new Map<string, { channel: RealtimeChannel; listeners: Set<Listener> }>();

function joinSession(sessionId: string) {
  let entry = channels.get(sessionId);
  if (!entry) {
    const listeners = new Set<Listener>();
    const channel = supabase.channel(`quiz:${sessionId}`);
    for (const event of EVENTS) {
      channel.on('broadcast', { event }, ({ payload }) => {
        for (const listener of [...listeners]) if (listener.events.includes(event)) listener.onEvent(event, payload);
      });
    }
    channel.subscribe();
    entry = { channel, listeners };
    channels.set(sessionId, entry);
  }
  return entry;
}

/** Listens to the session's broadcasts; by default only the game updates (state and scores). */
export function subscribeToSession(
  sessionId: string,
  onEvent: (event: SessionBroadcastEvent, payload: Record<string, unknown>) => void,
  events: SessionBroadcastEvent[] = ['STATE_CHANGE', 'SCORE_UPDATE'],
): () => void {
  const entry = joinSession(sessionId);
  const listener = { events, onEvent };
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0 && channels.get(sessionId) === entry) {
      channels.delete(sessionId);
      void supabase.removeChannel(entry.channel);
    }
  };
}

/** Sends a message to everyone on the session's channel; only while this page is subscribed to it. */
export function broadcastToSession(sessionId: string, event: SessionBroadcastEvent, payload: Record<string, unknown>): void {
  void channels
    .get(sessionId)
    ?.channel.send({ type: 'broadcast', event, payload })
    .catch(() => {
      // Best effort: a lost status message only affects what the control room displays.
    });
}
