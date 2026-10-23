import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { PubsService } from '../pubs/pubs.service';
import { InMemoryQuizzesRepository, InMemorySessionsRepository } from '../test-utils/in-memory-repositories';
import { SessionsController } from './sessions.controller';

async function build() {
  const quizzes = new InMemoryQuizzesRepository();
  const sessions = new InMemorySessionsRepository();
  const quiz = await quizzes.create('host1', 'Friday', null);
  const engine = { createSession: jest.fn().mockResolvedValue({ id: 's1' }) } as unknown as QuizEngineService;
  const controller = new SessionsController(engine, quizzes, sessions, {} as PubsService);
  return { controller, engine, quiz };
}

describe('SessionsController.create', () => {
  it('launches a quiz night for an active host', async () => {
    const { controller, engine, quiz } = await build();

    await controller.create(quiz.id, { id: 'host1', role: 'HOST', deactivated: false }, {});

    expect(engine.createSession).toHaveBeenCalledWith(quiz.id, 'host1', null);
  });

  it('refuses a deactivated host', async () => {
    const { controller, engine, quiz } = await build();

    await expect(controller.create(quiz.id, { id: 'host1', role: 'HOST', deactivated: true }, {})).rejects.toMatchObject({
      response: { code: 'HOST_DEACTIVATED' },
    });
    expect(engine.createSession).not.toHaveBeenCalled();
  });
});
