import { act, render, screen } from '@testing-library/react';
import type { ResolvedMediaDto } from '@quizicius/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import type { MediaControlMessage } from '../lib/media-channel';
import { sendMediaStatus } from '../lib/media-channel';
import { ProjectorMedia, ProjectorSound } from './MediaPlayer';

const channel = vi.hoisted(() => ({ onControl: null as ((message: MediaControlMessage) => void) | null }));
vi.mock('../lib/media-channel', () => ({
  subscribeToMediaControl: vi.fn((_sessionId: string, onControl: (message: MediaControlMessage) => void) => {
    channel.onControl = onControl;
    return () => undefined;
  }),
  sendMediaStatus: vi.fn(),
}));

const youtube = vi.hoisted(() => ({
  player: null as null | Record<'playVideo' | 'pauseVideo' | 'seekTo' | 'getCurrentTime' | 'destroy', ReturnType<typeof vi.fn>>,
  events: null as null | { onStateChange: (state: number) => void; onError: (code: number) => void },
}));
vi.mock('../lib/youtube', () => ({
  YT_STATE: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  loadYouTubeApi: vi.fn(),
  createYouTubePlayer: vi.fn(async (_el: HTMLElement, _id: string, _part: unknown, events: typeof youtube.events) => {
    youtube.events = events;
    youtube.player = { playVideo: vi.fn(), pauseVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn().mockReturnValue(0), destroy: vi.fn() };
    return youtube.player;
  }),
}));

type Fake = HTMLMediaElement & { fakeTime?: number; fakePaused?: boolean };
const SONG: ResolvedMediaDto = { kind: 'audio', url: 'https://cdn.test/song.mp3', startSeconds: 80, durationSeconds: 15 };
const FULL: ResolvedMediaDto = { kind: 'video', url: 'https://cdn.test/full.mp4', startSeconds: null, durationSeconds: null };
const control = (action: MediaControlMessage['action'], slot: MediaControlMessage['slot'] = 'question', questionId = 'q1') =>
  act(() => channel.onControl!({ questionId, slot, action, at: Date.now() }));
const statuses = () => vi.mocked(sendMediaStatus).mock.calls.map(([, status]) => `${status.slot}:${status.state}`);

let play: { mock: { calls: unknown[] } };
beforeEach(() => {
  vi.mocked(sendMediaStatus).mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get(this: Fake) {
      return this.fakeTime ?? 0;
    },
    set(this: Fake, value: number) {
      this.fakeTime = value;
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get(this: Fake) {
      return this.fakePaused ?? true;
    },
  });
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: Fake) {
    this.fakePaused = false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: Fake) {
    if (this.fakePaused === false) {
      this.fakePaused = true;
      this.dispatchEvent(new Event('pause'));
    }
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function show(props: Partial<Parameters<typeof ProjectorMedia>[0]> = {}, sound = true) {
  const element = (p: Partial<Parameters<typeof ProjectorMedia>[0]>) => (
    <I18nProvider>
      <ProjectorSound.Provider value={sound}>
        <ProjectorMedia sessionId="s1" questionId="q1" media={SONG} revealMedia={null} revealed={false} {...p} />
      </ProjectorSound.Provider>
    </I18nProvider>
  );
  const view = render(element(props));
  return { ...view, update: (next: Partial<Parameters<typeof ProjectorMedia>[0]>) => view.rerender(element({ ...props, ...next })) };
}
const audio = (slot = 'question') => screen.getByTestId(`projector-audio-${slot}`) as Fake;

describe('projector media', () => {
  it('waits for the host and plays nothing by itself', () => {
    show();

    expect(play.mock.calls).toHaveLength(0);
  });

  it('starts at the selected start the first time, and continues where it was paused', () => {
    show();

    control('play');
    expect(audio().currentTime).toBe(80);
    expect(statuses()).toContain('question:playing');

    audio().currentTime = 84;
    control('pause');
    control('play');

    expect(audio().currentTime).toBe(84);
    expect(play.mock.calls).toHaveLength(2);
  });

  it('replays from the start of the part, not from 0', () => {
    show();
    control('play');
    audio().currentTime = 90;

    control('replay');

    expect(audio().currentTime).toBe(80);
    expect(audio().paused).toBe(false);
  });

  it('stops at the end of the selected part and reports it ended', () => {
    show();
    control('play');

    audio().currentTime = 95.1;
    act(() => {
      audio().dispatchEvent(new Event('timeupdate'));
    });

    expect(audio().paused).toBe(true);
    expect(statuses()).toContain('question:ended');
  });

  it('stops playing at once when the host moves to the next question', () => {
    const view = show();
    control('play');
    const playing = audio();

    view.update({ questionId: 'q2' });

    expect(playing.paused).toBe(true);
    control('play', 'question', 'q1');
    expect(play.mock.calls).toHaveLength(1);
  });

  it('pauses the question clip when the answer is revealed', () => {
    const view = show();
    control('play');

    view.update({ revealed: true });

    expect(audio().paused).toBe(true);
  });

  it('reports blocked sound instead of playing before sound is enabled on the projector', () => {
    show({}, false);

    control('play');

    expect(play.mock.calls).toHaveLength(0);
    expect(statuses()).toEqual(['question:blocked']);
  });

  it('plays the reveal clip in place of the question media at the reveal', () => {
    show({ revealed: true, revealMedia: FULL });
    expect(screen.getByTestId('projector-media-question')).toBeVisible();

    control('play', 'reveal');

    expect(screen.getByTestId('projector-media-reveal')).toBeVisible();
    expect(screen.getByTestId('projector-media-question')).not.toBeVisible();
    expect((screen.getByTestId('projector-video-reveal') as Fake).paused).toBe(false);
  });

  it('shows a reveal image straight away at the reveal', () => {
    show({ revealed: true, revealMedia: { ...FULL, kind: 'image', url: 'https://cdn.test/answer.png' } });

    expect(screen.getByTestId('projector-reveal-image')).toBeVisible();
    expect(screen.getByTestId('projector-media-question')).not.toBeVisible();
  });

  it('plays YouTube through its player and reports a broken video', async () => {
    show({ media: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', startSeconds: 30, durationSeconds: null } });
    await act(async () => undefined);

    control('replay');
    expect(youtube.player!.seekTo).toHaveBeenCalledWith(30, true);
    expect(youtube.player!.playVideo).toHaveBeenCalled();

    act(() => youtube.events!.onError(150));
    expect(statuses()).toContain('question:error');
  });
});
