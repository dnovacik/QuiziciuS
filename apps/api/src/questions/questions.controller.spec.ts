import { InMemoryQuestionsRepository, InMemoryQuizzesRepository } from '../test-utils/in-memory-repositories';
import { QuestionsController } from './questions.controller';

const MB = 1024 * 1024;

describe('QuestionsController', () => {
  const host = { id: 'host-1' } as never;
  let quizzes: InMemoryQuizzesRepository;
  let questions: InMemoryQuestionsRepository;
  let controller: QuestionsController;
  let quizId: string;

  beforeEach(async () => {
    quizzes = new InMemoryQuizzesRepository();
    questions = new InMemoryQuestionsRepository();
    const storage = { createSignedUploadUrl: jest.fn().mockResolvedValue({ data: { token: 't' }, error: null }) };
    controller = new QuestionsController(quizzes, questions, { getClient: () => ({ storage: { from: () => storage } }) } as never);
    quizId = (await quizzes.create('host-1', 'Hudobný kvíz', null)).id;
  });

  const question = (extra: object) => ({
    type: 'FREE_TEXT' as const,
    prompt: 'Kto spieva?',
    acceptedAnswers: ['ABBA'],
    orderIndex: 0,
    ...extra,
  });

  it('stores question media and reveal media, with YouTube links in one form', async () => {
    const saved = await controller.create(
      quizId,
      host,
      question({
        media: { kind: 'youtube', source: 'link', url: 'https://youtu.be/dQw4w9WgXcQ?t=42', startSeconds: 80, durationSeconds: 15 },
        revealMedia: { kind: 'audio', source: 'upload', path: `host-1/${quizId}/full.mp3` },
      }),
    );

    expect(saved.media).toEqual({
      kind: 'youtube',
      source: 'link',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      startSeconds: 80,
      durationSeconds: 15,
    });
    expect(saved.reveal_media).toEqual({ kind: 'audio', source: 'upload', path: `host-1/${quizId}/full.mp3` });
  });

  it('saves a question without media as having none', async () => {
    const saved = await controller.create(quizId, host, question({}));

    expect(saved.media).toBeNull();
    expect(saved.reveal_media).toBeNull();
  });

  it('refuses an invalid clip and stores nothing', async () => {
    await expect(
      controller.create(quizId, host, question({ revealMedia: { kind: 'audio', source: 'link', url: 'http://cdn.example/a.mp3' } })),
    ).rejects.toMatchObject({ response: { code: 'INVALID_MEDIA' } });

    expect(await questions.listByQuiz(quizId)).toHaveLength(0);
  });

  it('updates both slots, and clears one that was removed', async () => {
    const saved = await controller.create(
      quizId,
      host,
      question({ media: { kind: 'audio', source: 'link', url: 'https://cdn.example/a.mp3' } }),
    );

    const updated = await controller.update(
      quizId,
      saved.id,
      host,
      question({ revealMedia: { kind: 'image', source: 'link', url: 'https://cdn.example/a.png' } }),
    );

    expect(updated.media).toBeNull();
    expect(updated.reveal_media).toEqual({ kind: 'image', source: 'link', url: 'https://cdn.example/a.png' });
  });

  describe('uploads', () => {
    it('accepts audio up to 25 MB', async () => {
      await expect(controller.createMediaUpload(quizId, host, { mimeType: 'audio/mpeg', fileSize: 20 * MB })).resolves.toMatchObject({
        mediaType: 'audio',
        path: expect.stringMatching(new RegExp(`^host-1/${quizId}/.+\\.mp3$`)),
      });
      await expect(controller.createMediaUpload(quizId, host, { mimeType: 'audio/mpeg', fileSize: 30 * MB })).rejects.toThrow();
    });

    it("accepts videos up to 50 MB, the storage plan's upload limit", async () => {
      await expect(controller.createMediaUpload(quizId, host, { mimeType: 'video/mp4', fileSize: 45 * MB })).resolves.toMatchObject({
        mediaType: 'video',
      });
      await expect(controller.createMediaUpload(quizId, host, { mimeType: 'video/mp4', fileSize: 60 * MB })).rejects.toThrow();
    });
  });

  describe('CSV', () => {
    it('adds imported questions after the existing ones, with the quiz default timer when none is given', async () => {
      await controller.create(quizId, host, question({}));
      await quizzes.update(quizId, { default_time_limit_seconds: 45 });

      const result = await controller.importCsv(quizId, host, {
        csv: 'type,prompt,answer,time_limit_seconds,media_url\nFREE_TEXT,Prvá?,A,,https://youtu.be/dQw4w9WgXcQ\nNUMERIC_NEAREST,Druhá?,7,0,\n',
      });

      expect(result).toEqual({ imported: 2 });
      const stored = await questions.listByQuiz(quizId);
      expect(stored.map((q) => [q.prompt, q.order_index, q.time_limit_seconds])).toEqual([
        ['Kto spieva?', 0, 30],
        ['Prvá?', 1, 45],
        ['Druhá?', 2, 0],
      ]);
      expect(stored[1].media).toEqual({ kind: 'youtube', source: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    });

    it('stores nothing when any row is wrong, and says which rows', async () => {
      await expect(
        controller.importCsv(quizId, host, {
          csv: 'type,prompt,answer,media_url\nFREE_TEXT,Dobrá?,A,\nFREE_TEXT,Zlá?,A,http://cdn.example/a.mp3\nFREE_TEXT,,A,\n',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'INVALID_CSV',
          errors: [{ row: 4, message: 'prompt is empty' }],
        },
      });
      // Media is only checked once the file itself reads cleanly.
      await expect(
        controller.importCsv(quizId, host, {
          csv: 'type,prompt,answer,media_url\nFREE_TEXT,Dobrá?,A,\nFREE_TEXT,Zlá?,A,http://cdn.example/a.mp3\n',
        }),
      ).rejects.toMatchObject({ response: { errors: [{ row: 3, message: 'Media: Links must start with https://' }] } });

      expect(await questions.listByQuiz(quizId)).toHaveLength(0);
    });

    it('exports the quiz under a file name made from its title', async () => {
      await controller.create(quizId, host, question({}));

      const exported = await controller.exportCsv(quizId, host);

      expect(exported.filename).toBe('hudobny-kviz.csv');
      expect(exported.csv).toContain('FREE_TEXT,Kto spieva?,,ABBA,,1,30');
    });

    it("refuses another host's quiz", async () => {
      await expect(controller.exportCsv(quizId, { id: 'host-2' } as never)).rejects.toThrow('Not your quiz');
      await expect(controller.importCsv(quizId, { id: 'host-2' } as never, { csv: 'type,prompt,answer\nFREE_TEXT,x,y' })).rejects.toThrow(
        'Not your quiz',
      );
    });
  });
});
