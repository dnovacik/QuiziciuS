import { createClient } from '@supabase/supabase-js';

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
