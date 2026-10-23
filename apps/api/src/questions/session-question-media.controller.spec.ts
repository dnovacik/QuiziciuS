import { SessionQuestionMediaController } from './session-question-media.controller';

const host = { id: 'host' } as never;
const clip = { kind: 'audio', source: 'link', url: 'https://cdn.example/song.mp3', startSeconds: 80, durationSeconds: 15 };

describe('SessionQuestionMediaController', () => {
  const sign = jest.fn().mockResolvedValue({ data: { signedUrl: 'https://example.test/signed' }, error: null });
  const sessions = { findById: jest.fn() };
  const questions = { findById: jest.fn() };
  const realtime = { publish: jest.fn().mockResolvedValue(undefined) };
  const controller = new SessionQuestionMediaController(
    sessions as never,
    questions as never,
    { getClient: () => ({ storage: { from: () => ({ createSignedUrl: sign }) } }) } as never,
    realtime as never,
  );
  const inState = (status: string) =>
    sessions.findById.mockResolvedValue({ id: 's1', host_id: 'host', quiz_id: 'quiz', current_question_id: 'q1', status });
  beforeEach(() => {
    jest.clearAllMocks();
    inState('QUESTION_ACTIVE');
    questions.findById.mockResolvedValue({
      id: 'q1',
      quiz_id: 'quiz',
      media: { kind: 'image', source: 'upload', path: 'host/quiz/a.png' },
      reveal_media: clip,
    });
  });

  it('issues a short-lived link for an uploaded file of the current question', async () => {
    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({
      media: { kind: 'image', url: 'https://example.test/signed', startSeconds: null, durationSeconds: null },
      revealMedia: null,
    });
    expect(sign).toHaveBeenCalledWith('host/quiz/a.png', 900);
  });

  it('serves a linked clip as is, with its part', async () => {
    questions.findById.mockResolvedValueOnce({ id: 'q1', quiz_id: 'quiz', media: clip, reveal_media: null });

    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({
      media: { kind: 'audio', url: 'https://cdn.example/song.mp3', startSeconds: 80, durationSeconds: 15 },
      revealMedia: null,
    });
    expect(sign).not.toHaveBeenCalled();
  });

  it.each(['LOCK_IN_ROUND', 'QUESTION_ACTIVE'])('keeps the reveal media hidden during %s', async (status) => {
    inState(status);

    const served = await controller.currentQuestionMedia('s1');

    expect(served.media).toMatchObject({ kind: 'image' });
    expect(served.revealMedia).toBeNull();
  });

  it('serves the reveal media at the reveal', async () => {
    inState('QUESTION_REVEAL');

    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({
      media: expect.objectContaining({ kind: 'image' }),
      revealMedia: { kind: 'audio', url: 'https://cdn.example/song.mp3', startSeconds: 80, durationSeconds: 15 },
    });
  });

  it('does not serve media from a lobby or future question', async () => {
    inState('LOBBY');
    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({ media: null, revealMedia: null });
    expect(questions.findById).not.toHaveBeenCalled();
  });

  it('does not expose question media from a different quiz', async () => {
    inState('QUESTION_REVEAL');
    questions.findById.mockResolvedValueOnce({
      quiz_id: 'another',
      media: { kind: 'video', source: 'upload', path: 'other.mp4' },
      reveal_media: clip,
    });
    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({ media: null, revealMedia: null });
    expect(sign).not.toHaveBeenCalled();
  });

  describe('playback control', () => {
    it('tells the projector to play the question clip while answering', async () => {
      await controller.control('s1', host, { slot: 'question', action: 'play' });

      expect(realtime.publish).toHaveBeenCalledWith(
        's1',
        'MEDIA_CONTROL',
        expect.objectContaining({ questionId: 'q1', slot: 'question', action: 'play', at: expect.any(Number) }),
      );
    });

    it('lets the host play the reveal clip at the reveal', async () => {
      inState('QUESTION_REVEAL');

      await controller.control('s1', host, { slot: 'reveal', action: 'replay' });

      expect(realtime.publish).toHaveBeenCalledWith('s1', 'MEDIA_CONTROL', expect.objectContaining({ slot: 'reveal', action: 'replay' }));
    });

    it('refuses the reveal clip before the reveal', async () => {
      await expect(controller.control('s1', host, { slot: 'reveal', action: 'play' })).rejects.toMatchObject({
        status: 409,
        response: { code: 'MEDIA_NOT_AVAILABLE' },
      });
      expect(realtime.publish).not.toHaveBeenCalled();
    });

    it('refuses playback in the lock-in, and for an empty slot', async () => {
      inState('LOCK_IN_ROUND');
      await expect(controller.control('s1', host, { slot: 'question', action: 'play' })).rejects.toMatchObject({ status: 409 });

      inState('QUESTION_REVEAL');
      questions.findById.mockResolvedValueOnce({ id: 'q1', quiz_id: 'quiz', media: clip, reveal_media: null });
      await expect(controller.control('s1', host, { slot: 'reveal', action: 'play' })).rejects.toMatchObject({ status: 409 });
      expect(realtime.publish).not.toHaveBeenCalled();
    });

    it("refuses another host's session", async () => {
      await expect(controller.control('s1', { id: 'someone-else' } as never, { slot: 'question', action: 'play' })).rejects.toMatchObject({
        status: 403,
      });
      expect(realtime.publish).not.toHaveBeenCalled();
    });
  });

  describe('for smooth loading', () => {
    function fresh() {
      const signer = jest
        .fn()
        .mockImplementation(async () => ({ data: { signedUrl: `https://example.test/signed-${signer.mock.calls.length}` }, error: null }));
      const c = new SessionQuestionMediaController(
        sessions as never,
        questions as never,
        { getClient: () => ({ storage: { from: () => ({ createSignedUrl: signer }) } }) } as never,
        realtime as never,
      );
      return { c, signer };
    }

    afterEach(() => jest.useRealTimers());

    it('serves the current question during the lock-in, so screens can preload it', async () => {
      const { c } = fresh();
      inState('LOCK_IN_ROUND');

      await expect(c.currentQuestionMedia('s1')).resolves.toMatchObject({ media: { kind: 'image', url: expect.any(String) } });
    });

    it('gives every screen the same link, so the file downloads once and then comes from the cache', async () => {
      const { c, signer } = fresh();

      const first = await c.currentQuestionMedia('s1');
      const second = await c.currentQuestionMedia('s1');

      expect(second.media?.url).toBe(first.media?.url);
      expect(signer).toHaveBeenCalledTimes(1);
    });

    it('signs a new link well before the old one expires', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-28T19:00:00Z') });
      const { c, signer } = fresh();
      const first = await c.currentQuestionMedia('s1');

      jest.setSystemTime(new Date('2026-10-28T19:11:00Z'));
      const later = await c.currentQuestionMedia('s1');

      expect(later.media?.url).not.toBe(first.media?.url);
      expect(signer).toHaveBeenCalledTimes(2);
    });
  });
});
