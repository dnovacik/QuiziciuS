import { act, renderHook, waitFor } from '@testing-library/react';
import type { QuizSessionStateDto } from '@quizicius/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from './api-client';
import { useSessionState } from './use-session-state';

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiGet: vi.fn(),
}));
const realtime = vi.hoisted(() => ({ emit: null as null | (() => void) }));
vi.mock('./supabase-client', () => ({
  subscribeToSession: vi.fn((_id: string, onEvent: () => void) => {
    realtime.emit = onEvent;
    return vi.fn();
  }),
}));

function state(status: QuizSessionStateDto['status']): QuizSessionStateDto {
  return {
    id: 's1',
    joinCode: 'A7F3',
    status,
    currentQuestion: null,
    questionEndsAt: null,
    questionPausedAt: null,
    answeredCount: null,
    playedQuestionIds: [],
    breakEndsAt: null,
    breakMessage: null,
    teams: [],
  };
}

beforeEach(() => {
  vi.mocked(apiGet).mockReset().mockResolvedValue(state('LOBBY'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('live session state', () => {
  it('catches up when a phone wakes up, since it may have missed updates while asleep', async () => {
    const { result } = renderHook(() => useSessionState('s1'));
    await waitFor(() => expect(result.current.state?.status).toBe('LOBBY'));
    vi.mocked(apiGet).mockResolvedValue(state('QUESTION_ACTIVE'));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(result.current.state?.status).toBe('QUESTION_ACTIVE'));
  });

  it('catches up when the realtime channel subscribes again', async () => {
    const { result } = renderHook(() => useSessionState('s1'));
    await waitFor(() => expect(result.current.state?.status).toBe('LOBBY'));
    vi.mocked(apiGet).mockResolvedValue(state('QUESTION_REVEAL'));

    act(() => realtime.emit!());

    await waitFor(() => expect(result.current.state?.status).toBe('QUESTION_REVEAL'));
  });

  it('catches up when the network comes back', async () => {
    const { result } = renderHook(() => useSessionState('s1'));
    await waitFor(() => expect(result.current.state?.status).toBe('LOBBY'));
    vi.mocked(apiGet).mockResolvedValue(state('PAUSE_BREAK'));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.state?.status).toBe('PAUSE_BREAK'));
  });

  it('re-checks now and then, in case an update never arrived', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useSessionState('s1'));
    await waitFor(() => expect(result.current.state?.status).toBe('LOBBY'));
    vi.mocked(apiGet).mockResolvedValue(state('FINISHED'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() => expect(result.current.state?.status).toBe('FINISHED'));
  });

  it('ignores a slow, older answer that arrives after a newer one', async () => {
    let releaseOld: (value: QuizSessionStateDto) => void = () => {};
    const { result } = renderHook(() => useSessionState('s1'));
    await waitFor(() => expect(result.current.state?.status).toBe('LOBBY'));
    vi.mocked(apiGet)
      .mockImplementationOnce(() => new Promise((resolve) => (releaseOld = resolve)))
      .mockResolvedValueOnce(state('QUESTION_ACTIVE'));

    act(() => realtime.emit!());
    act(() => realtime.emit!());
    await waitFor(() => expect(result.current.state?.status).toBe('QUESTION_ACTIVE'));
    await act(async () => releaseOld(state('LOCK_IN_ROUND')));

    expect(result.current.state?.status).toBe('QUESTION_ACTIVE');
  });
});
