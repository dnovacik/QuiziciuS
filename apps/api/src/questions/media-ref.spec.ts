import { normalizeMediaRef, youtubeId } from './media-ref';

const HOST = 'host-1';
const QUIZ = 'quiz-1';
const invalid = { response: { code: 'INVALID_MEDIA' } };
const norm = (input: unknown) => normalizeMediaRef(input, HOST, QUIZ);

describe('normalizeMediaRef', () => {
  it('treats a missing slot as no media', () => {
    expect(norm(null)).toBeNull();
    expect(norm(undefined)).toBeNull();
  });

  it("keeps an upload from the quiz's own folder and refuses anything else", () => {
    expect(norm({ kind: 'audio', source: 'upload', path: 'host-1/quiz-1/a.mp3' })).toEqual({
      kind: 'audio',
      source: 'upload',
      path: 'host-1/quiz-1/a.mp3',
    });
    expect(() => norm({ kind: 'audio', source: 'upload', path: 'host-2/quiz-1/a.mp3' })).toThrow();
    expect(() => norm({ kind: 'audio', source: 'upload', path: 'host-1/quiz-1/../x.mp3' })).toThrow();
  });

  it('accepts https links only', () => {
    expect(norm({ kind: 'audio', source: 'link', url: 'https://cdn.example/a.mp3' })).toEqual({
      kind: 'audio',
      source: 'link',
      url: 'https://cdn.example/a.mp3',
    });
    let error: unknown;
    try {
      norm({ kind: 'audio', source: 'link', url: 'http://cdn.example/a.mp3' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject(invalid);
  });

  it.each([
    'https://youtu.be/dQw4w9WgXcQ?t=42',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
  ])('stores the YouTube link %s in one canonical form', (url) => {
    expect(norm({ kind: 'youtube', source: 'link', url })).toEqual({
      kind: 'youtube',
      source: 'link',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('recognises a YouTube link sent as a video', () => {
    expect(norm({ kind: 'video', source: 'link', url: 'https://youtu.be/dQw4w9WgXcQ' })).toMatchObject({ kind: 'youtube' });
  });

  it('keeps the selected part and refuses impossible ones', () => {
    expect(norm({ kind: 'audio', source: 'link', url: 'https://cdn.example/a.mp3', startSeconds: 80, durationSeconds: 15 })).toEqual({
      kind: 'audio',
      source: 'link',
      url: 'https://cdn.example/a.mp3',
      startSeconds: 80,
      durationSeconds: 15,
    });
    expect(() => norm({ kind: 'audio', source: 'link', url: 'https://cdn.example/a.mp3', startSeconds: -1 })).toThrow();
    expect(() => norm({ kind: 'audio', source: 'link', url: 'https://cdn.example/a.mp3', durationSeconds: 0 })).toThrow();
  });

  it('ignores a part on an image', () => {
    expect(norm({ kind: 'image', source: 'link', url: 'https://cdn.example/a.png', startSeconds: 5, durationSeconds: 3 })).toEqual({
      kind: 'image',
      source: 'link',
      url: 'https://cdn.example/a.png',
    });
  });

  it('refuses unknown kinds and a YouTube "upload"', () => {
    expect(() => norm({ kind: 'gif', source: 'link', url: 'https://cdn.example/a.gif' })).toThrow();
    expect(() => norm({ kind: 'youtube', source: 'upload', path: 'host-1/quiz-1/a.mp4' })).toThrow();
  });
});

describe('youtubeId', () => {
  it('finds the video id, or nothing for other sites', () => {
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://vimeo.com/123')).toBeNull();
  });
});
