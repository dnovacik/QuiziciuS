import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { InfractionsRepository } from '../data/infractions.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { ScoreAdjustmentsRepository } from '../data/score-adjustments.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { InvalidTransitionError } from './state-transitions';
import { QuizEngineService } from './quiz-engine.service';

const BASE_SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  pub_id: null,
  status: 'LOBBY',
  current_question_id: null,
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: null,
  finished_at: null,
};

const NUMERIC_QUESTION: QuestionRecord = {
  id: 'q1',
  quiz_id: 'quiz1',
  type: 'NUMERIC_NEAREST',
  prompt: 'Population of Slovakia (millions)?',
  options: null,
  accepted_answers: null,
  correct_numeric: 5.4,
  points: 4,
  time_limit_seconds: 20,
  order_index: 0,
};

function buildHarness(overrides?: { session?: Partial<SessionRecord> }) {
  const session = { ...BASE_SESSION, ...overrides?.session };

  const sessions: SessionsRepository = {
    listByHost: jest.fn(),
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(session),
    findByJoinCode: jest.fn().mockResolvedValue(session),
    updateStatus: jest.fn().mockImplementation(async (_id: string, patch) => ({ ...session, ...patch })),
  };
  const questions: QuestionsRepository = {
    findById: jest.fn().mockResolvedValue(NUMERIC_QUESTION),
    listByQuiz: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const teams: TeamsRepository = {
    findById: jest.fn(),
    findBySessionAndName: jest.fn(),
    findBySessionAndRegisteredTeam: jest.fn().mockResolvedValue(null),
    upsertJoin: jest.fn(),
    setDeviceTokenHash: jest.fn(),
    markReady: jest.fn().mockResolvedValue(undefined),
    listBySession: jest.fn().mockResolvedValue([] as TeamRecord[]),
  };
  const answers: AnswersRepository = {
    upsertSubmission: jest.fn(),
    findById: jest.fn(),
    listByQuestion: jest.fn().mockResolvedValue([] as AnswerRecord[]),
    listNeedsReview: jest.fn(),
    listBySession: jest.fn().mockResolvedValue([] as AnswerRecord[]),
    updateGrade: jest.fn().mockImplementation(async (id: string, patch) => ({
      id,
      session_id: 's1',
      question_id: 'q1',
      team_id: 't1',
      response: {},
      is_correct: null,
      confidence: null,
      needs_review: false,
      graded_by: null,
      graded_at: null,
      submitted_at: '2026-09-16T00:00:00.000Z',
      score_awarded: 0,
      ...patch,
    })),
  };
  const infractions: InfractionsRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    listBySession: jest.fn().mockResolvedValue([]),
    markReviewed: jest.fn(),
  };
  const scoreAdjustments: ScoreAdjustmentsRepository = { create: jest.fn(), listBySession: jest.fn().mockResolvedValue([]) };
  const broadcast = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RealtimeBroadcastService;

  const service = new QuizEngineService(sessions, questions, teams, answers, infractions, scoreAdjustments, broadcast);
  return { service, sessions, questions, teams, answers, infractions, scoreAdjustments, broadcast, session };
}

describe('QuizEngineService.transitionState', () => {
  it('rejects an illegal transition without persisting or broadcasting', async () => {
    const { service, sessions, broadcast } = buildHarness({ session: { status: 'LOBBY' } });

    await expect(service.transitionState('s1', 'host1', 'QUESTION_ACTIVE')).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(sessions.updateStatus).not.toHaveBeenCalled();
    expect(broadcast.publish).not.toHaveBeenCalled();
  });

  it('rejects a transition requested by a host who does not own the session', async () => {
    const { service } = buildHarness({ session: { status: 'LOBBY' } });

    await expect(service.transitionState('s1', 'someone-else', 'LOCK_IN_ROUND', { questionId: 'q1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws NotFoundException for an unknown session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.transitionState('missing', 'host1', 'LOCK_IN_ROUND')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets question_ends_at from the question time limit on entering QUESTION_ACTIVE', async () => {
    const { service, sessions, broadcast } = buildHarness({
      session: { status: 'LOCK_IN_ROUND', current_question_id: 'q1' },
    });

    const before = Date.now();
    const result = await service.transitionState('s1', 'host1', 'QUESTION_ACTIVE');
    const endsAt = new Date(result.question_ends_at as string).getTime();

    expect(endsAt).toBeGreaterThanOrEqual(before + NUMERIC_QUESTION.time_limit_seconds * 1000);
    expect(sessions.updateStatus).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'QUESTION_ACTIVE' }));
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'STATE_CHANGE', expect.any(Object));
  });

  it('grades numeric answers and broadcasts a score update on entering QUESTION_REVEAL', async () => {
    const { service, answers, broadcast } = buildHarness({
      session: { status: 'QUESTION_ACTIVE', current_question_id: 'q1' },
    });
    (answers.listByQuestion as jest.Mock).mockResolvedValue([
      { id: 'a1', team_id: 't1', response: { value: 5.5 } },
      { id: 'a2', team_id: 't2', response: { value: 1 } },
    ]);

    await service.transitionState('s1', 'host1', 'QUESTION_REVEAL');

    expect(answers.updateGrade).toHaveBeenCalledWith('a1', expect.objectContaining({ is_correct: true, graded_by: 'AUTO' }));
    expect(answers.updateGrade).toHaveBeenCalledWith('a2', expect.objectContaining({ is_correct: false, graded_by: 'AUTO' }));
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'SCORE_UPDATE', expect.any(Object));
  });

  it('requires a questionId when transitioning into LOCK_IN_ROUND', async () => {
    const { service } = buildHarness({ session: { status: 'LOBBY' } });

    await expect(service.transitionState('s1', 'host1', 'LOCK_IN_ROUND')).rejects.toThrow('questionId is required');
  });

  it('rejects a LOCK_IN_ROUND question that belongs to another quiz', async () => {
    const { service, sessions, questions, broadcast } = buildHarness({ session: { status: 'LOBBY' } });
    (questions.findById as jest.Mock).mockResolvedValue({ ...NUMERIC_QUESTION, id: 'q-foreign', quiz_id: 'other-quiz' });

    await expect(service.transitionState('s1', 'host1', 'LOCK_IN_ROUND', { questionId: 'q-foreign' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(sessions.updateStatus).not.toHaveBeenCalled();
    expect(broadcast.publish).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the LOCK_IN_ROUND questionId does not exist', async () => {
    const { service, sessions, questions } = buildHarness({ session: { status: 'LOBBY' } });
    (questions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.transitionState('s1', 'host1', 'LOCK_IN_ROUND', { questionId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sessions.updateStatus).not.toHaveBeenCalled();
  });

  it('accepts a LOCK_IN_ROUND question that belongs to the session quiz', async () => {
    const { service, sessions } = buildHarness({ session: { status: 'LOBBY' } });

    await service.transitionState('s1', 'host1', 'LOCK_IN_ROUND', { questionId: 'q1' });

    expect(sessions.updateStatus).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ status: 'LOCK_IN_ROUND', current_question_id: 'q1' }),
    );
  });

  it('grades a malformed numeric answer as incorrect without poisoning the rest of the round', async () => {
    const { service, answers } = buildHarness({
      session: { status: 'QUESTION_ACTIVE', current_question_id: 'q1' },
    });
    (answers.listByQuestion as jest.Mock).mockResolvedValue([
      { id: 'a1', team_id: 't1', response: { value: 5.5 } },
      { id: 'a2', team_id: 't2', response: { value: 'not-a-number' } },
      { id: 'a3', team_id: 't3', response: {} },
    ]);

    await service.transitionState('s1', 'host1', 'QUESTION_REVEAL');

    // The one valid answer is still the nearest and takes the full 4 points.
    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ is_correct: true, graded_by: 'AUTO', score_awarded: 4 }),
    );
    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a2',
      expect.objectContaining({ is_correct: false, graded_by: 'AUTO', score_awarded: 0 }),
    );
    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a3',
      expect.objectContaining({ is_correct: false, graded_by: 'AUTO', score_awarded: 0 }),
    );
  });
});

describe('QuizEngineService.getState', () => {
  const MC_QUESTION: QuestionRecord = {
    id: 'q-mc',
    quiz_id: 'quiz1',
    type: 'MULTIPLE_CHOICE',
    prompt: 'Capital of France?',
    options: [
      { id: 'a', label: 'Paris', isCorrect: true },
      { id: 'b', label: 'Lyon', isCorrect: false },
    ],
    accepted_answers: null,
    correct_numeric: null,
    points: 2,
    time_limit_seconds: 20,
    order_index: 0,
  };

  it('hides the correct option while the question is still active', async () => {
    const { service, sessions, questions } = buildHarness({
      session: { status: 'QUESTION_ACTIVE', current_question_id: 'q-mc' },
    });
    (questions.findById as jest.Mock).mockResolvedValue(MC_QUESTION);
    void sessions;

    const state = await service.getState('s1');

    expect(state.currentQuestion?.options).toEqual([
      { id: 'a', label: 'Paris' },
      { id: 'b', label: 'Lyon' },
    ]);
    expect(state.currentQuestion?.correctOptionId).toBeNull();
  });

  it('reveals the correct option once the session reaches QUESTION_REVEAL', async () => {
    const { service, questions } = buildHarness({
      session: { status: 'QUESTION_REVEAL', current_question_id: 'q-mc' },
    });
    (questions.findById as jest.Mock).mockResolvedValue(MC_QUESTION);

    const state = await service.getState('s1');

    expect(state.currentQuestion?.correctOptionId).toBe('a');
  });

  it('sums each team score from graded answers', async () => {
    const { service, teams, answers } = buildHarness({ session: { status: 'LOBBY' } });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (answers.listBySession as jest.Mock).mockResolvedValue([
      { team_id: 't1', score_awarded: 2 },
      { team_id: 't1', score_awarded: 1 },
    ]);

    const state = await service.getState('s1');

    expect(state.teams).toEqual([
      {
        id: 't1',
        name: 'Team A',
        isActive: true,
        registeredTeamId: null,
        ready: false,
        readyFullscreen: false,
        score: 3,
        infractionCount: 0,
      },
    ]);
  });

  it('reports which teams are ready for the locked-in question', async () => {
    const { service, teams } = buildHarness({ session: { status: 'LOCK_IN_ROUND', current_question_id: 'q2' } });
    const base = { session_id: 's1', device_token_hash: null, joined_at: 'now', is_active: true, registered_team_id: null };
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { ...base, id: 't1', name: 'Fullscreen', ready_question_id: 'q2', ready_fullscreen: true },
      { ...base, id: 't2', name: 'No fullscreen', ready_question_id: 'q2', ready_fullscreen: false },
      { ...base, id: 't3', name: 'Last question', ready_question_id: 'q1', ready_fullscreen: true },
    ]);

    const state = await service.getState('s1');

    expect(state.teams.map(({ id, ready, readyFullscreen }) => ({ id, ready, readyFullscreen }))).toEqual([
      { id: 't1', ready: true, readyFullscreen: true },
      { id: 't2', ready: true, readyFullscreen: false },
      { id: 't3', ready: false, readyFullscreen: false },
    ]);
  });

  it('drops readiness once the question is open', async () => {
    const { service, teams } = buildHarness({ session: { status: 'QUESTION_ACTIVE', current_question_id: 'q2' } });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      {
        id: 't1',
        session_id: 's1',
        name: 'A',
        device_token_hash: null,
        joined_at: 'now',
        is_active: true,
        ready_question_id: 'q2',
        ready_fullscreen: true,
      },
    ]);

    expect((await service.getState('s1')).teams[0].ready).toBe(false);
  });

  it('leaves the open question out of team scores until its results are public', async () => {
    const { service, teams, answers } = buildHarness({
      session: { status: 'QUESTION_ACTIVE', current_question_id: 'q2', question_ends_at: new Date(Date.now() + 10_000).toISOString() },
    });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (answers.listBySession as jest.Mock).mockResolvedValue([
      { team_id: 't1', question_id: 'q1', score_awarded: 2 },
      { team_id: 't1', question_id: 'q2', score_awarded: 5 },
    ]);

    expect((await service.getState('s1')).teams[0].score).toBe(2);
  });

  it('counts the open question once its timer has run out', async () => {
    const { service, teams, answers } = buildHarness({
      session: { status: 'QUESTION_ACTIVE', current_question_id: 'q2', question_ends_at: new Date(Date.now() - 5_000).toISOString() },
    });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (answers.listBySession as jest.Mock).mockResolvedValue([
      { team_id: 't1', question_id: 'q1', score_awarded: 2 },
      { team_id: 't1', question_id: 'q2', score_awarded: 5 },
    ]);

    expect((await service.getState('s1')).teams[0].score).toBe(7);
  });

  it('throws NotFoundException for an unknown session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.getState('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('includes each team infraction count from InfractionsRepository', async () => {
    const { service, teams, infractions } = buildHarness({ session: { status: 'LOBBY' } });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (infractions.listBySession as jest.Mock).mockResolvedValue([
      { id: 'i1', session_id: 's1', team_id: 't1', type: 'VISIBILITY_HIDDEN', detected_at: 'now', reviewed: false },
      { id: 'i2', session_id: 's1', team_id: 't1', type: 'FULLSCREEN_EXIT', detected_at: 'now', reviewed: false },
    ]);

    const state = await service.getState('s1');

    expect(state.teams[0].infractionCount).toBe(2);
  });

  it('includes paper-mode score adjustments in each team total', async () => {
    const { service, teams, scoreAdjustments } = buildHarness({ session: { status: 'LOBBY' } });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (scoreAdjustments.listBySession as jest.Mock).mockResolvedValue([
      { id: 'a1', session_id: 's1', team_id: 't1', points: 3, reason: null, created_at: 'now' },
    ]);

    const state = await service.getState('s1');

    expect(state.teams[0].score).toBe(3);
  });
});

describe('QuizEngineService.addPaperScore', () => {
  it('records a manual score adjustment for a host-owned session', async () => {
    const { service, scoreAdjustments } = buildHarness();

    await service.addPaperScore('s1', 'host1', 't1', 3, 'Paper round 2');

    expect(scoreAdjustments.create).toHaveBeenCalledWith('s1', 't1', 3, 'Paper round 2');
  });

  it('rejects a host who does not own the session', async () => {
    const { service } = buildHarness();

    await expect(service.addPaperScore('s1', 'someone-else', 't1', 3, null)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('QuizEngineService.resolveDispute', () => {
  it('approves a disputed answer and awards full points', async () => {
    const { service, answers, questions, broadcast } = buildHarness();
    (answers.findById as jest.Mock).mockResolvedValue({
      id: 'a1',
      session_id: 's1',
      question_id: 'q1',
      team_id: 't1',
      needs_review: true,
    });

    const result = await service.resolveDispute('a1', 'host1', 'APPROVE');

    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ is_correct: true, needs_review: false, graded_by: 'HOST', score_awarded: 4 }),
    );
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'SCORE_UPDATE', expect.any(Object));
    expect(result.graded_by).toBe('HOST');
    void questions;
  });

  it('rejects a disputed answer and awards zero points', async () => {
    const { service, answers } = buildHarness();
    (answers.findById as jest.Mock).mockResolvedValue({
      id: 'a1',
      session_id: 's1',
      question_id: 'q1',
      team_id: 't1',
      needs_review: true,
    });

    await service.resolveDispute('a1', 'host1', 'REJECT');

    expect(answers.updateGrade).toHaveBeenCalledWith('a1', expect.objectContaining({ is_correct: false, score_awarded: 0 }));
  });

  it('rejects a dispute resolution requested by a host who does not own the session', async () => {
    const { service, answers } = buildHarness();
    (answers.findById as jest.Mock).mockResolvedValue({
      id: 'a1',
      session_id: 's1',
      question_id: 'q1',
      team_id: 't1',
      needs_review: true,
    });

    await expect(service.resolveDispute('a1', 'someone-else', 'APPROVE')).rejects.toBeInstanceOf(ForbiddenException);
    expect(answers.updateGrade).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the disputed answer does not exist', async () => {
    const { service, answers } = buildHarness();
    (answers.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.resolveDispute('missing', 'host1', 'APPROVE')).rejects.toBeInstanceOf(NotFoundException);
    expect(answers.updateGrade).not.toHaveBeenCalled();
  });
});

describe('QuizEngineService.listDisputes', () => {
  it('returns answers needing review for a host-owned session', async () => {
    const { service, answers } = buildHarness();
    (answers.listNeedsReview as jest.Mock).mockResolvedValue([{ id: 'a1', team_id: 't1', needs_review: true }]);

    const result = await service.listDisputes('s1', 'host1');

    expect(answers.listNeedsReview).toHaveBeenCalledWith('s1');
    expect(result).toEqual([expect.objectContaining({ id: 'a1', teamId: 't1', needsReview: true })]);
  });

  it('rejects a host who does not own the session', async () => {
    const { service } = buildHarness();

    await expect(service.listDisputes('s1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('QuizEngineService.listAnswers', () => {
  it('returns graded answers of one question for the owning host', async () => {
    const { service, answers } = buildHarness();
    (answers.listByQuestion as jest.Mock).mockResolvedValue([
      { id: 'a1', team_id: 't1', question_id: 'q1', is_correct: true, score_awarded: 2, needs_review: false },
    ]);

    const result = await service.listAnswers('s1', 'host1', 'q1');

    expect(answers.listByQuestion).toHaveBeenCalledWith('s1', 'q1');
    expect(result).toEqual([expect.objectContaining({ teamId: 't1', isCorrect: true, scoreAwarded: 2 })]);
  });

  it('rejects a host who does not own the session', async () => {
    const { service } = buildHarness();
    await expect(service.listAnswers('s1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('QuizEngineService.createSession', () => {
  it('creates a session with a generated join code', async () => {
    const { service, sessions } = buildHarness();

    await service.createSession('quiz1', 'host1');

    expect(sessions.create).toHaveBeenCalledWith('quiz1', 'host1', expect.stringMatching(/^[A-HJ-NP-Z2-9]{4}$/), null);
  });
});
