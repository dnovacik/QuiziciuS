import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from './api-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('asks ngrok to skip its browser warning, so API calls work through a free tunnel', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiGet('/sessions/s1/state');

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ 'ngrok-skip-browser-warning': '1' });
  });
});
