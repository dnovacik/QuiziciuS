import { SubscriptionDto } from '@quizicius/shared-types';
import { BadRequestException } from '@nestjs/common';
import { LeaguesService } from '../leagues/leagues.service';
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
  const pubs = { requirePub: jest.fn(async (id: string) => ({ id, name: 'KC Hoffman', city: 'Žilina' })) } as unknown as PubsService;
  const leagues = {
    assertCanLaunch: jest.fn().mockResolvedValue(undefined),
    publicInfo: jest.fn(async (id: string) => ({ id, name: 'Zimná liga', kind: 'LEAGUE' })),
  } as unknown as LeaguesService & { assertCanLaunch: jest.Mock };
  const controller = new SessionsController(engine, quizzes, sessions, pubs, leagues);
  return { controller, engine, quiz, sessions, leagues };
}

describe('SessionsController.create', () => {
  it('launches a quiz night for an active host', async () => {
    const { controller, engine, quiz } = await build();

    await controller.create(quiz.id, { id: 'host1', role: 'HOST', deactivated: false, subscription: ACTIVE }, {});

    expect(engine.createSession).toHaveBeenCalledWith(quiz.id, 'host1', null, null);
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

describe('league nights', () => {
  const host = { id: 'host1', role: 'HOST' as const, deactivated: false, subscription: ACTIVE };

  it('checks the host may run the league at that pub, then ticks the night for it', async () => {
    const { controller, engine, quiz, leagues } = await build();

    await controller.create(quiz.id, host, { pubId: 'pub-1', leagueId: 'league-1' });

    expect(leagues.assertCanLaunch).toHaveBeenCalledWith('host1', 'league-1', 'pub-1');
    expect(engine.createSession).toHaveBeenCalledWith(quiz.id, 'host1', 'pub-1', 'league-1');
  });

  it('does not launch when the league check fails', async () => {
    const { controller, engine, quiz, leagues } = await build();
    leagues.assertCanLaunch.mockRejectedValueOnce(new BadRequestException({ code: 'PUB_NOT_IN_LEAGUE' }));

    await expect(controller.create(quiz.id, host, { pubId: 'pub-1', leagueId: 'league-1' })).rejects.toMatchObject({
      response: { code: 'PUB_NOT_IN_LEAGUE' },
    });
    expect(engine.createSession).not.toHaveBeenCalled();
  });

  it('tells players and the projector which league the night counts for', async () => {
    const { controller, quiz, sessions } = await build();
    const night = await sessions.create(quiz.id, 'host1', 'AB12', null, 'league-1');
    const plain = await sessions.create(quiz.id, 'host1', 'CD34');

    expect((await controller.displayMetadata(night.id)).league).toEqual({ id: 'league-1', name: 'Zimná liga', kind: 'LEAGUE' });
    expect((await controller.displayMetadata(plain.id)).league).toBeNull();
  });
});
