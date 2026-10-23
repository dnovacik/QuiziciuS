import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AnswersRepository } from './data/answers.repository';
import { InfractionsRepository } from './data/infractions.repository';
import { QuestionsRepository } from './data/questions.repository';
import { QuizzesRepository } from './data/quizzes.repository';
import { ScoreAdjustmentsRepository } from './data/score-adjustments.repository';
import { SessionsRepository } from './data/sessions.repository';
import { TeamsRepository } from './data/teams.repository';
import { InvalidTransitionExceptionFilter } from './quiz-engine/invalid-transition.filter';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import {
  InMemoryAnswersRepository,
  InMemoryInfractionsRepository,
  InMemoryQuestionsRepository,
  InMemoryQuizzesRepository,
  InMemoryScoreAdjustmentsRepository,
  InMemorySessionsRepository,
  InMemoryTeamsRepository,
} from './test-utils/in-memory-repositories';

// Stub required environment variables before importing AppModule, since
// ConfigModule.forRoot's validator runs eagerly at module-class evaluation
// time (i.e. when app.module.ts is imported), not lazily at test run time.
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.TEAM_TOKEN_SECRET = 'integration-test-secret';

import { AppModule } from './app.module';

describe('Session lifecycle (integration)', () => {
  let app: INestApplication;
  let quizId: string;
  let questionId: string;

  beforeAll(async () => {
    const quizzesRepo = new InMemoryQuizzesRepository();
    const questionsRepo = new InMemoryQuestionsRepository();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SessionsRepository)
      .useValue(new InMemorySessionsRepository())
      .overrideProvider(QuestionsRepository)
      .useValue(questionsRepo)
      .overrideProvider(TeamsRepository)
      .useValue(new InMemoryTeamsRepository())
      .overrideProvider(AnswersRepository)
      .useValue(new InMemoryAnswersRepository())
      .overrideProvider(InfractionsRepository)
      .useValue(new InMemoryInfractionsRepository())
      .overrideProvider(QuizzesRepository)
      .useValue(quizzesRepo)
      .overrideProvider(ScoreAdjustmentsRepository)
      .useValue(new InMemoryScoreAdjustmentsRepository())
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().authHost = { id: 'host1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new InvalidTransitionExceptionFilter());
    await app.init();

    const quiz = await quizzesRepo.create('host1', 'Integration Quiz', null);
    quizId = quiz.id;
    const question = await questionsRepo.create(quizId, {
      type: 'MULTIPLE_CHOICE',
      prompt: 'Capital of France?',
      options: [
        { id: 'a', label: 'Paris', isCorrect: true },
        { id: 'b', label: 'Lyon', isCorrect: false },
      ],
      accepted_answers: null,
      correct_numeric: null,
      points: 5,
      time_limit_seconds: 20,
      order_index: 0,
    });
    questionId = question.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('drives a full session from LOBBY through FINISHED, grading an answer along the way', async () => {
    const server = app.getHttpServer();

    const createRes = await request(server).post(`/quizzes/${quizId}/sessions`).send({});
    expect(createRes.status).toBe(201);
    const sessionId: string = createRes.body.id;

    const joinRes = await request(server).post(`/sessions/${sessionId}/teams/join`).send({ name: 'The Quizzards' });
    expect(joinRes.status).toBe(201);
    const teamToken: string = joinRes.body.token;

    await request(server)
      .post(`/sessions/${sessionId}/transition`)
      .send({ status: 'LOCK_IN_ROUND', questionId })
      .expect(201);

    await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'QUESTION_ACTIVE' }).expect(201);

    const submitRes = await request(server)
      .post(`/sessions/${sessionId}/answers`)
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ questionId, response: { optionId: 'a' } });
    expect(submitRes.status).toBe(201);
    // Grading stays hidden while the question is open — both in the reply and in the scores.
    expect(submitRes.body.isCorrect).toBeNull();
    const openState = await request(server).get(`/sessions/${sessionId}/state`);
    expect(openState.body.teams).toEqual([expect.objectContaining({ score: 0 })]);

    await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'QUESTION_REVEAL' }).expect(201);
    const mineRes = await request(server).get(`/sessions/${sessionId}/answers/mine`).set('Authorization', `Bearer ${teamToken}`);
    expect(mineRes.status).toBe(200);
    expect(mineRes.body).toEqual([expect.objectContaining({ questionId, isCorrect: true, scoreAwarded: 5 })]);

    await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'FINISHED' }).expect(201);

    const stateRes = await request(server).get(`/sessions/${sessionId}/state`);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.status).toBe('FINISHED');
    expect(stateRes.body.teams).toEqual([expect.objectContaining({ name: 'The Quizzards', score: 5 })]);
  });

  it('lets the host dismiss an infraction, draining it from the review queue', async () => {
    const server = app.getHttpServer();
    const createRes = await request(server).post(`/quizzes/${quizId}/sessions`).send({});
    const sessionId: string = createRes.body.id;
    const joinRes = await request(server).post(`/sessions/${sessionId}/teams/join`).send({ name: 'Flaggers' });
    const teamToken: string = joinRes.body.token;

    await request(server)
      .post('/api/infractions/report')
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ type: 'VISIBILITY_HIDDEN' })
      .expect(201);

    const listed = await request(server).get(`/sessions/${sessionId}/infractions`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    const infractionId: string = listed.body[0].id;

    const reviewRes = await request(server).patch(
      `/sessions/${sessionId}/infractions/${infractionId}/review`,
    );
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.reviewed).toBe(true);

    const afterReview = await request(server).get(`/sessions/${sessionId}/infractions`);
    expect(afterReview.body).toEqual([]);
  });

  it('resolves a join code to its session id without any credentials', async () => {
    const server = app.getHttpServer();
    const createRes = await request(server).post(`/quizzes/${quizId}/sessions`).send({});
    const sessionId: string = createRes.body.id;
    const joinCode: string = createRes.body.join_code;

    const res = await request(server).get(`/sessions/by-code/${joinCode.toLowerCase()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: sessionId });
  });

  it('returns 404 for a join code with no open session', async () => {
    // 'I' is excluded from the join-code alphabet, so no generated code can collide.
    const res = await request(app.getHttpServer()).get('/sessions/by-code/IIII');

    expect(res.status).toBe(404);
  });

  it('rejects an illegal transition with 409 and the current state', async () => {
    const server = app.getHttpServer();
    const createRes = await request(server).post(`/quizzes/${quizId}/sessions`).send({});
    const sessionId: string = createRes.body.id;

    const res = await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'QUESTION_ACTIVE' });

    expect(res.status).toBe(409);
    expect(res.body.currentState).toBe('LOBBY');
  });
});
