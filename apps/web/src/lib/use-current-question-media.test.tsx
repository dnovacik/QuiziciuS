import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from './api-client';
import { clearQuestionMediaCache, useCurrentQuestionMedia, usePreloadQuestionMedia } from './use-current-question-media';

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiGet: vi.fn(),
}));

const IMAGE = { mediaType: 'image' as const, url: 'https://cdn.test/q1.png' };

beforeEach(() => {
  clearQuestionMediaCache();
  vi.mocked(apiGet).mockReset().mockResolvedValue(IMAGE);
});

describe('question media', () => {
  it('shows nothing before the question is on screen', () => {
    const { result } = renderHook(() => useCurrentQuestionMedia('s1', 'q1', 'LOCK_IN_ROUND'));

    expect(result.current.media).toBeNull();
  });

  it('keeps the same media from answering to the reveal, without asking again', async () => {
    const { result, rerender } = renderHook(({ status }) => useCurrentQuestionMedia('s1', 'q1', status), {
      initialProps: { status: 'QUESTION_ACTIVE' as const } as { status: 'QUESTION_ACTIVE' | 'QUESTION_REVEAL' },
    });
    await waitFor(() => expect(result.current.media).toEqual(IMAGE));

    rerender({ status: 'QUESTION_REVEAL' });

    expect(result.current.media).toEqual(IMAGE);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('downloads the media during the lock-in, so the question shows it straight away', async () => {
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
    vi.restoreAllMocks();
  });

  it('loads the next question fresh', async () => {
    const { result, rerender } = renderHook(({ id }) => useCurrentQuestionMedia('s1', id, 'QUESTION_ACTIVE'), {
      initialProps: { id: 'q1' },
    });
    await waitFor(() => expect(result.current.media).toEqual(IMAGE));
    vi.mocked(apiGet).mockResolvedValue({ mediaType: null, url: null });

    rerender({ id: 'q2' });

    await waitFor(() => expect(result.current.media).toEqual({ mediaType: null, url: null }));
  });
});
