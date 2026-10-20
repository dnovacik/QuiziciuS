import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizSecurity } from './use-quiz-security';

function mockWakeLock() {
  const sentinel = { release: vi.fn().mockResolvedValue(undefined) };
  const request = vi.fn().mockResolvedValue(sentinel);
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinel };
}

describe('useQuizSecurity', () => {
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestFullscreen = vi.fn().mockResolvedValue(undefined);
    exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    });
    Object.defineProperty(document, 'exitFullscreen', { value: exitFullscreen, configurable: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('activates Wake Lock and Fullscreen on QUESTION_ACTIVE', () => {
    const { request } = mockWakeLock();
    renderHook(() => useQuizSecurity('QUESTION_ACTIVE', 'team-token'));

    expect(request).toHaveBeenCalledWith('screen');
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it('activates anti-cheat on LOCK_IN_ROUND too', () => {
    const { request } = mockWakeLock();
    renderHook(() => useQuizSecurity('LOCK_IN_ROUND', 'team-token'));

    expect(request).toHaveBeenCalledWith('screen');
  });

  it('does not activate anti-cheat in LOBBY', () => {
    const { request } = mockWakeLock();
    renderHook(() => useQuizSecurity('LOBBY', 'team-token'));

    expect(request).not.toHaveBeenCalled();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('releases Wake Lock and exits Fullscreen when transitioning to QUESTION_REVEAL', async () => {
    const { request, sentinel } = mockWakeLock();
    const { rerender } = renderHook(({ status }) => useQuizSecurity(status, 'team-token'), {
      initialProps: { status: 'QUESTION_ACTIVE' as const },
    });

    // Let the initial wakeLock.request() settle before triggering cleanup.
    await act(async () => {
      await request.mock.results[0].value;
    });

    rerender({ status: 'QUESTION_REVEAL' as const });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sentinel.release).toHaveBeenCalled();
  });

  it('reports a VISIBILITY_HIDDEN infraction while a round is active', () => {
    mockWakeLock();
    renderHook(() => useQuizSecurity('QUESTION_ACTIVE', 'team-token'));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/infractions/report'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer team-token' }),
      }),
    );
  });

  it('does not report an infraction when no round is active', () => {
    mockWakeLock();
    renderHook(() => useQuizSecurity('LOBBY', 'team-token'));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetch).not.toHaveBeenCalled();
  });

  it('exposes requestFullscreenNow for a "Tap to Lock-In" gesture to call directly', () => {
    mockWakeLock();
    const { result } = renderHook(() => useQuizSecurity('LOCK_IN_ROUND', 'team-token'));
    requestFullscreen.mockClear(); // clear the effect's own best-effort attempt

    act(() => {
      result.current.requestFullscreenNow();
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
