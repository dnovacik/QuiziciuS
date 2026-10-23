import { MutableRefObject, useEffect, useRef } from 'react';
import { QuizState } from '@quizicius/shared-types';
import { apiPost } from '../lib/api-client';

const ACTIVE_STATES: readonly QuizState[] = ['LOCK_IN_ROUND', 'QUESTION_ACTIVE'];

type WakeLockPromiseRef = MutableRefObject<Promise<WakeLockSentinel> | null>;

function requestWakeLock(ref: WakeLockPromiseRef): void {
  if (!('wakeLock' in navigator)) return;
  // Assigned synchronously so cleanup can always chain onto it, regardless of
  // whether the underlying request has resolved yet.
  ref.current = navigator.wakeLock.request('screen');
}

function releaseWakeLock(ref: WakeLockPromiseRef): void {
  const pending = ref.current;
  ref.current = null;
  void pending?.then((sentinel) => sentinel.release()).catch(() => {});
}

/** Resolves to whether the page is in fullscreen afterwards (iPhone Safari has no fullscreen API). */
function requestFullscreen(): Promise<boolean> {
  const el = document.documentElement;
  if (document.fullscreenElement) return Promise.resolve(true);
  if (!el.requestFullscreen) return Promise.resolve(false);
  return el.requestFullscreen().then(
    () => true,
    () => false,
  );
}

function exitFullscreenIfActive(): void {
  if (document.fullscreenElement && document.exitFullscreen) {
    void document.exitFullscreen().catch(() => {});
  }
}

export function useQuizSecurity(status: QuizState, teamToken: string | null): { requestFullscreenNow: () => Promise<boolean> } {
  const wakeLockRef = useRef<Promise<WakeLockSentinel> | null>(null);

  useEffect(() => {
    const isActive = ACTIVE_STATES.includes(status);

    if (!isActive) {
      releaseWakeLock(wakeLockRef);
      exitFullscreenIfActive();
      return;
    }

    requestWakeLock(wakeLockRef);
    void requestFullscreen(); // best-effort; browsers usually reject this outside a user gesture

    return () => {
      releaseWakeLock(wakeLockRef);
    };
  }, [status]);

  useEffect(() => {
    function handleVisibilityChange(): void {
      const isActive = ACTIVE_STATES.includes(status);
      if (document.visibilityState === 'hidden' && isActive && teamToken) {
        apiPost('/api/infractions/report', { type: 'VISIBILITY_HIDDEN' }, teamToken).catch(() => {
          // Best-effort — a failed infraction report must never block gameplay.
        });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, teamToken]);

  // Called from the "Tap to Lock-In" overlay's onClick (Task 22) — a real user gesture, so
  // requestFullscreen() is reliably granted here even when the effect above was rejected.
  function requestFullscreenNow(): Promise<boolean> {
    return requestFullscreen();
  }

  return { requestFullscreenNow };
}
