import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from './api-client';
import { clearQuestionMediaCache, useCurrentQuestionMedia, usePreloadQuestionMedia } from './use-current-question-media';

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiGet: vi.fn(),
}));

const IMAGE = { kind: 'image' as const, url: 'https://cdn.test/q1.png', startSeconds: null, durationSeconds: null };
const SONG = { kind: 'audio' as const, url: 'https://cdn.test/full.mp3', startSeconds: 80, durationSeconds: null };
const served = (media: unknown, revealMedia: unknown = null) => ({ media, revealMedia });

beforeEach(() => {
  clearQuestionMediaCache();
  vi.mocked(apiGet).mockReset().mockResolvedValue(served(IMAGE));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('question media', () => {
  it('shows nothing before the question is on screen', () => {
    const { result } = renderHook(() => useCurrentQuestionMedia('s1', 'q1', 'LOCK_IN_ROUND'));

    expect(result.current.media).toBeNull();
  });

  it('keeps the question media through the reveal and adds the reveal media then', async () => {
    const { result, rerender } = renderHook(({ status }) => useCurrentQuestionMedia('s1', 'q1', status), {
      initialProps: { status: 'QUESTION_ACTIVE' } as { status: 'QUESTION_ACTIVE' | 'QUESTION_REVEAL' },
    });
    await waitFor(() => expect(result.current.media).toEqual(IMAGE));
    expect(result.current.revealMedia).toBeNull();
    vi.mocked(apiGet).mockResolvedValue(served(IMAGE, SONG));

    rerender({ status: 'QUESTION_REVEAL' });

    expect(result.current.media).toEqual(IMAGE);
    await waitFor(() => expect(result.current.revealMedia).toEqual(SONG));
    expect(result.current.media).toEqual(IMAGE);
  });

  it('downloads an image during the lock-in, so the question shows it straight away', async () => {
    const created: HTMLImageElement[] = [];
    const RealImage = window.Image;
    vi.spyOn(window, 'Image').mockImplementation(() => {
      const img = new RealImage();
      created.push(img);
      return img;
    });
    renderHook(() => usePreloadQuestionMedia('s1', 'q1', 'LOCK_IN_ROUND'));
    await waitFor(() => expect(created.map((img) => img.src)).toEqual([IMAGE.url]));

    const { result } = renderHook(() => useCurrentQuestionMedia('s1', 'q1', 'QUESTION_ACTIVE'));

    expect(result.current.media).toEqual(IMAGE);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('leaves clips for the projector to download, not the phones', async () => {
    const load = vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.mocked(apiGet).mockResolvedValue(served(SONG));

    renderHook(() => usePreloadQuestionMedia('s1', 'q1', 'LOCK_IN_ROUND'));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(load).not.toHaveBeenCalled();

    clearQuestionMediaCache();
    renderHook(() => usePreloadQuestionMedia('s1', 'q2', 'LOCK_IN_ROUND', { clips: true }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    // Only the start of the file: the projector's own player downloads the rest, once.
    expect((load.mock.instances[0] as unknown as HTMLMediaElement).preload).toBe('metadata');
  });

  it('loads the next question fresh', async () => {
    const { result, rerender } = renderHook(({ id }) => useCurrentQuestionMedia('s1', id, 'QUESTION_ACTIVE'), {
      initialProps: { id: 'q1' },
    });
    await waitFor(() => expect(result.current.media).toEqual(IMAGE));
    vi.mocked(apiGet).mockResolvedValue(served(null));

    rerender({ id: 'q2' });

    await waitFor(() => expect(result.current.media).toBeNull());
  });
});
