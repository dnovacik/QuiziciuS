import { describe, expect, it } from 'vitest';
import { detectLink, formatPart, formatTime, parseTime } from './media-ref';

describe('detectLink', () => {
  it.each([
    'https://youtu.be/dQw4w9WgXcQ?t=42',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  ])('recognises the YouTube link %s', (url) => {
    expect(detectLink(url)).toEqual({ kind: 'youtube', url });
  });

  it('takes the kind from the file extension', () => {
    expect(detectLink('https://cdn.example/song.mp3')).toEqual({ kind: 'audio', url: 'https://cdn.example/song.mp3' });
    expect(detectLink('https://cdn.example/a.M4A?x=1')).toMatchObject({ kind: 'audio' });
    expect(detectLink('https://cdn.example/scene.mp4')).toMatchObject({ kind: 'video' });
    expect(detectLink('https://cdn.example/poster.jpg')).toMatchObject({ kind: 'image' });
  });

  it('leaves the kind open for an unknown extension', () => {
    expect(detectLink(' https://cdn.example/stream ')).toEqual({ kind: null, url: 'https://cdn.example/stream' });
  });

  it('refuses anything that is not an https link', () => {
    expect(detectLink('http://cdn.example/song.mp3')).toBeNull();
    expect(detectLink('song.mp3')).toBeNull();
  });
});

describe('times', () => {
  it('reads m:ss and plain seconds', () => {
    expect(parseTime('1:20')).toBe(80);
    expect(parseTime('80')).toBe(80);
    expect(parseTime('1:02:05')).toBe(3725);
    expect(parseTime('')).toBeUndefined();
    expect(parseTime('1:75')).toBeNull();
    expect(parseTime('abc')).toBeNull();
  });

  it('writes m:ss', () => {
    expect(formatTime(80)).toBe('1:20');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('describes the selected part', () => {
    expect(formatPart({ startSeconds: 80, durationSeconds: 15 })).toBe('1:20 – 1:35');
    expect(formatPart({ startSeconds: 80 })).toBe('1:20 –');
    expect(formatPart({ durationSeconds: 15 })).toBe('0:00 – 0:15');
    expect(formatPart({})).toBe('');
  });
});
