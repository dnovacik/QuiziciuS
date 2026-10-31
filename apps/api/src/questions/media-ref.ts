import { BadRequestException } from '@nestjs/common';
import { MediaKind, MediaRefDto } from '@quizicius/shared-types';

const KINDS: MediaKind[] = ['image', 'video', 'audio', 'youtube'];
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const invalid = (message: string) => new BadRequestException({ code: 'INVALID_MEDIA', message });

/** The video id of a YouTube link (watch, youtu.be, shorts; any host variant), or null. */
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
    else {
      const match = url.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
      id = match?.[2] ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

function seconds(value: unknown, name: string, positive: boolean): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0) || n > 24 * 3600) throw invalid(`Invalid ${name}`);
  return Math.round(n * 10) / 10;
}

/**
 * Checks and normalises one media slot. Uploads must live in the quiz's own storage folder, links
 * must be https, YouTube links are stored as `https://www.youtube.com/watch?v=<id>`, and images
 * carry no start/length. Returns null for an empty slot.
 */
export function normalizeMediaRef(input: unknown, hostId: string, quizId: string): MediaRefDto | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object') throw invalid('Invalid media');
  const raw = input as Record<string, unknown>;
  let kind = raw.kind as MediaKind;
  if (!KINDS.includes(kind)) throw invalid('Unknown media kind');

  let ref: MediaRefDto;
  if (raw.source === 'upload') {
    const path = typeof raw.path === 'string' ? raw.path : '';
    if (kind === 'youtube' || !path.startsWith(`${hostId}/${quizId}/`) || path.includes('..')) throw invalid('Invalid upload');
    ref = { kind, source: 'upload', path };
  } else if (raw.source === 'link') {
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!/^https:\/\/[^\s]+$/i.test(url)) throw invalid('Links must start with https://');
    const id = youtubeId(url);
    if (id) kind = 'youtube';
    else if (kind === 'youtube') throw invalid('Not a YouTube link');
    ref = { kind, source: 'link', url: id ? `https://www.youtube.com/watch?v=${id}` : url };
  } else {
    throw invalid('Unknown media source');
  }

  if (kind !== 'image') {
    const startSeconds = seconds(raw.startSeconds, 'start', false);
    const durationSeconds = seconds(raw.durationSeconds, 'length', true);
    if (startSeconds !== undefined) ref.startSeconds = startSeconds;
    if (durationSeconds !== undefined) ref.durationSeconds = durationSeconds;
  }
  if (kind === 'youtube' && raw.audioOnly === true) ref.audioOnly = true;
  return ref;
}
