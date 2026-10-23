import { SubscriptionDto } from '@quizicius/shared-types';
import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { PubsService } from '../pubs/pubs.service';
import { InMemoryQuizzesRepository, InMemorySessionsRepository } from '../test-utils/in-memory-repositories';
import { SessionsController } from './sessions.controller';

const ACTIVE: SubscriptionDto = { status: 'ACTIVE', until: '2026-12-31', forever: false };

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

    await controller.create(quiz.id, { id: 'host1', role: 'HOST', deactivated: false, subscription: ACTIVE }, {});

    expect(engine.createSession).toHaveBeenCalledWith(quiz.id, 'host1', null);
  });

  it('refuses a deactivated host', async () => {
    const { controller, engine, quiz } = await build();

    await expect(
      controller.create(quiz.id, { id: 'host1', role: 'HOST', deactivated: true, subscription: ACTIVE }, {}),
    ).rejects.toMatchObject({
      response: { code: 'HOST_DEACTIVATED' },
    });
    expect(engine.createSession).not.toHaveBeenCalled();
  });

  it('refuses a host whose subscription has expired', async () => {
    const { controller, engine, quiz } = await build();
    const expired: SubscriptionDto = { status: 'EXPIRED', until: '2026-10-01', forever: false };

    await expect(
      controller.create(quiz.id, { id: 'host1', role: 'HOST', deactivated: false, subscription: expired }, {}),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_EXPIRED' },
    });
    expect(engine.createSession).not.toHaveBeenCalled();
  });

  it('lets a host on trial or with a forever subscription launch nights', async () => {
    const { controller, engine, quiz } = await build();

    await controller.create(
      quiz.id,
      { id: 'host1', role: 'HOST', deactivated: false, subscription: { status: 'TRIAL', until: '2026-11-06', forever: false } },
      {},
    );
    await controller.create(
      quiz.id,
      { id: 'host1', role: 'HOST', deactivated: false, subscription: { status: 'FOREVER', until: null, forever: true } },
      {},
    );

    expect(engine.createSession).toHaveBeenCalledTimes(2);
  });
});
