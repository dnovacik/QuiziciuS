import type { MediaKind } from '@quizicius/shared-types';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const EXTENSIONS: Record<string, MediaKind> = {
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  ogg: 'audio',
  oga: 'audio',
  opus: 'audio',
  wav: 'audio',
  mp4: 'video',
  m4v: 'video',
  webm: 'video',
  mov: 'video',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
};

/** The video id of a YouTube link (watch, youtu.be, shorts, embed; any host variant), or null. Mirrors the API. */
export function youtubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/)?.[2] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/**
 * What a pasted link is: YouTube, or a file whose kind comes from its extension (`kind: null` when
 * the extension says nothing, so the host is asked). Null for anything that is not an https link.
 */
export function detectLink(raw: string): { kind: MediaKind | null; url: string } | null {
  const url = raw.trim();
  if (!/^https:\/\/\S+$/i.test(url)) return null;
  if (youtubeId(url)) return { kind: 'youtube', url };
  const extension = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
  return { kind: EXTENSIONS[extension] ?? null, url };
}

/** "1:20", "80" or "1:02:05" → seconds; undefined for an empty field, null for something unreadable. */
export function parseTime(text: string): number | undefined | null {
  const value = text.trim();
  if (!value) return undefined;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Seconds → "m:ss" (or "h:mm:ss"). */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** The selected part, e.g. "1:20 – 1:35"; empty when the whole clip plays. */
export function formatPart(ref: { startSeconds?: number | null; durationSeconds?: number | null }): string {
  const start = ref.startSeconds ?? null;
  const duration = ref.durationSeconds ?? null;
  if (start === null && duration === null) return '';
  if (duration === null) return `${formatTime(start!)} –`;
  return `${formatTime(start ?? 0)} – ${formatTime((start ?? 0) + duration)}`;
}
