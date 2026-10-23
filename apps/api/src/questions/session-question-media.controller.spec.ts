import { SessionQuestionMediaController } from './session-question-media.controller';
describe('SessionQuestionMediaController', () => {
  const sign = jest.fn().mockResolvedValue({ data: { signedUrl: 'https://example.test/signed' }, error: null });
  const sessions = { findById: jest.fn() };
  const questions = { findById: jest.fn() };
  const controller = new SessionQuestionMediaController(
    sessions as never,
    questions as never,
    { getClient: () => ({ storage: { from: () => ({ createSignedUrl: sign }) } }) } as never,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    sessions.findById.mockResolvedValue({ id: 's1', quiz_id: 'quiz', current_question_id: 'q1', status: 'QUESTION_ACTIVE' });
    questions.findById.mockResolvedValue({ id: 'q1', quiz_id: 'quiz', media_type: 'image', media_path: 'host/quiz/a.png' });
  });
  it('issues short lived URL for active current question', async () => {
    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({ mediaType: 'image', url: 'https://example.test/signed' });
    expect(sign).toHaveBeenCalledWith('host/quiz/a.png', 900);
  });
  it('does not serve media from a lobby or future question', async () => {
    sessions.findById.mockResolvedValueOnce({ quiz_id: 'quiz', current_question_id: 'q1', status: 'LOBBY' });
    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({ mediaType: null, url: null });
    expect(questions.findById).not.toHaveBeenCalled();
  });
  it('does not expose question media from a different quiz', async () => {
    questions.findById.mockResolvedValueOnce({ quiz_id: 'another', media_type: 'video', media_path: 'other.mp4' });
    await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({ mediaType: null, url: null });
    expect(sign).not.toHaveBeenCalled();
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
      );
      return { c, signer };
    }

    afterEach(() => jest.useRealTimers());

    it('serves the current question during the lock-in, so screens can preload it', async () => {
      const { c } = fresh();
      sessions.findById.mockResolvedValue({ id: 's1', quiz_id: 'quiz', current_question_id: 'q1', status: 'LOCK_IN_ROUND' });

      await expect(c.currentQuestionMedia('s1')).resolves.toMatchObject({ mediaType: 'image', url: expect.any(String) });
    });

    it('gives every screen the same link, so the file downloads once and then comes from the cache', async () => {
      const { c, signer } = fresh();

      const first = await c.currentQuestionMedia('s1');
      const second = await c.currentQuestionMedia('s1');

      expect(second.url).toBe(first.url);
      expect(signer).toHaveBeenCalledTimes(1);
    });

    it('signs a new link well before the old one expires', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-28T19:00:00Z') });
      const { c, signer } = fresh();
      const first = await c.currentQuestionMedia('s1');

      jest.setSystemTime(new Date('2026-10-28T19:11:00Z'));
      const later = await c.currentQuestionMedia('s1');

      expect(later.url).not.toBe(first.url);
      expect(signer).toHaveBeenCalledTimes(2);
    });
  });
});
