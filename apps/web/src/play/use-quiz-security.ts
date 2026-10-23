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

function requestFullscreen(): void {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    void el.requestFullscreen().catch(() => {});
  }
}

function exitFullscreenIfActive(): void {
  if (document.fullscreenElement && document.exitFullscreen) {
    void document.exitFullscreen().catch(() => {});
  }
}

export function useQuizSecurity(status: QuizState, teamToken: string | null): { requestFullscreenNow: () => void } {
  const wakeLockRef = useRef<Promise<WakeLockSentinel> | null>(null);

  useEffect(() => {
    const isActive = ACTIVE_STATES.includes(status);

    if (!isActive) {
      releaseWakeLock(wakeLockRef);
      exitFullscreenIfActive();
      return;
    }

    requestWakeLock(wakeLockRef);
    requestFullscreen(); // best-effort; browsers usually reject this outside a user gesture

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
  function requestFullscreenNow(): void {
    requestFullscreen();
  }

  return { requestFullscreenNow };
}
