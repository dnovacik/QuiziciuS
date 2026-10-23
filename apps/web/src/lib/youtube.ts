/** The few parts of the YouTube IFrame Player API the projector uses. */
export interface YouTubePlayer {
  cueVideoById(options: { videoId: string; startSeconds?: number; endSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** YT.PlayerState values. */
export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

let loading: Promise<YouTubeApi> | null = null;

/** Loads https://www.youtube.com/iframe_api once, the first time a YouTube clip is needed. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!loading) {
    loading = new Promise<YouTubeApi>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        loading = null;
        reject(new Error('YouTube could not be loaded'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/**
 * A player for one video, cued (loaded, not playing) at the selected part. Resolves once it is
 * ready to take play / pause / seek calls.
 */
export async function createYouTubePlayer(
  element: HTMLElement,
  videoId: string,
  part: { start: number; end: number | null },
  events: { onStateChange: (state: number) => void; onError: (code: number) => void },
): Promise<YouTubePlayer> {
  const api = await loadYouTubeApi();
  return new Promise((resolve) => {
    const player: YouTubePlayer = new api.Player(element, {
      width: '100%',
      height: '100%',
      playerVars: { controls: 0, rel: 0, playsinline: 1, modestbranding: 1, disablekb: 1, iv_load_policy: 3 },
      events: {
        onReady: () => {
          player.cueVideoById({ videoId, startSeconds: part.start, ...(part.end !== null ? { endSeconds: part.end } : {}) });
          resolve(player);
        },
        onStateChange: (event) => events.onStateChange(event.data),
        onError: (event) => events.onError(event.data),
      },
    });
  });
}
