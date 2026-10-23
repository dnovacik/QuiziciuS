import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { AnswersService } from './answers.service';

const ACTIVE_SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  pub_id: null,
  status: 'QUESTION_ACTIVE',
  current_question_id: 'q1',
  question_ends_at: new Date(Date.now() + 10_000).toISOString(),
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: '2026-09-16T00:00:00.000Z',
  finished_at: null,
};

const MC_QUESTION: QuestionRecord = {
  id: 'q1',
  quiz_id: 'quiz1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Capital of France?',
  options: [
    { id: 'a', label: 'Paris', isCorrect: true },
    { id: 'b', label: 'Lyon', isCorrect: false },
  ],
  accepted_answers: null,
  correct_numeric: null,
  points: 3,
  time_limit_seconds: 20,
  order_index: 0,
};

function buildAnswerRecord(overrides?: Partial<AnswerRecord>): AnswerRecord {
  return {
    id: 'ans1',
    session_id: 's1',
    question_id: 'q1',
    team_id: 't1',
    response: { optionId: 'a' },
    is_correct: null,
    confidence: null,
    needs_review: false,
    graded_by: null,
    graded_at: null,
    submitted_at: '2026-09-16T00:00:00.000Z',
    score_awarded: 0,
    ...overrides,
  };
}

function buildHarness(overrides?: { session?: Partial<SessionRecord>; question?: QuestionRecord }) {
  const session = { ...ACTIVE_SESSION, ...overrides?.session };
  const question = overrides?.question ?? MC_QUESTION;

  const sessions = { findById: jest.fn().mockResolvedValue(session) } as unknown as SessionsRepository;
  const questions = { findById: jest.fn().mockResolvedValue(question) } as unknown as QuestionsRepository;
  const answers: AnswersRepository = {
    upsertSubmission: jest.fn().mockImplementation(async (input) => buildAnswerRecord({ response: input.response })),
    findById: jest.fn(),
    listByQuestion: jest.fn(),
    listNeedsReview: jest.fn(),
    listBySession: jest.fn(),
    updateGrade: jest.fn().mockImplementation(async (id: string, patch) => buildAnswerRecord({ id, ...patch })),
  };
  const broadcast = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RealtimeBroadcastService;

  const service = new AnswersService(sessions, questions, answers, broadcast);
  return { service, sessions, questions, answers, broadcast };
}

describe('AnswersService.submit', () => {
  it('auto-grades a correct multiple-choice answer immediately', async () => {
    const { service, answers, broadcast } = buildHarness();

    const result = await service.submit('s1', 't1', 'q1', { optionId: 'a' });

    expect(answers.upsertSubmission).toHaveBeenCalledWith({
      sessionId: 's1',
      questionId: 'q1',
      teamId: 't1',
      response: { optionId: 'a' },
    });
    expect(answers.updateGrade).toHaveBeenCalledWith(
      'ans1',
      expect.objectContaining({ is_correct: true, graded_by: 'AUTO', score_awarded: 3 }),
    );
    // The grade is stored but not returned while the question is open (no probing by resubmitting).
    expect(result).toMatchObject({ isCorrect: null, scoreAwarded: 0, needsReview: false, gradedBy: null });
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'SCORE_UPDATE', { teamId: 't1' });
  });

  it('auto-grades an incorrect multiple-choice answer as zero points', async () => {
    const { service, answers } = buildHarness();

    await service.submit('s1', 't1', 'q1', { optionId: 'b' });

    expect(answers.updateGrade).toHaveBeenCalledWith('ans1', expect.objectContaining({ is_correct: false, score_awarded: 0 }));
  });

  it('sends a low-confidence free-text answer to the dispute queue instead of auto-grading', async () => {
    const freeTextQuestion: QuestionRecord = {
      ...MC_QUESTION,
      type: 'FREE_TEXT',
      options: null,
      accepted_answers: ['Paris'],
    };
    const { service, answers } = buildHarness({ question: freeTextQuestion });

    await service.submit('s1', 't1', 'q1', { text: 'Pahhris' });

    expect(answers.updateGrade).toHaveBeenCalledWith(
      'ans1',
      expect.objectContaining({ needs_review: true, is_correct: null, graded_by: null }),
    );
  });

  it('leaves a numeric answer ungraded until reveal', async () => {
    const numericQuestion: QuestionRecord = {
      ...MC_QUESTION,
      type: 'NUMERIC_NEAREST',
      options: null,
      correct_numeric: 5.4,
    };
    const { service, answers } = buildHarness({ question: numericQuestion });

    await service.submit('s1', 't1', 'q1', { value: 5 });

    expect(answers.updateGrade).not.toHaveBeenCalled();
  });

  it('rejects a submission for a question that is not the active one', async () => {
    const { service } = buildHarness({ session: { current_question_id: 'some-other-question' } });

    await expect(service.submit('s1', 't1', 'q1', { optionId: 'a' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a submission after the grace window has closed', async () => {
    const { service } = buildHarness({ session: { question_ends_at: new Date(Date.now() - 10_000).toISOString() } });

    await expect(service.submit('s1', 't1', 'q1', { optionId: 'a' })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects a submission for an unknown session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.submit('missing', 't1', 'q1', { optionId: 'a' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AnswersService.listForTeam', () => {
  const graded = (questionId: string, teamId = 't1') =>
    buildAnswerRecord({
      id: `${questionId}-${teamId}`,
      question_id: questionId,
      team_id: teamId,
      is_correct: true,
      graded_by: 'AUTO',
      score_awarded: 3,
    });

  it('hides the grade of the open question but keeps earlier results', async () => {
    const { service, answers } = buildHarness();
    (answers.listBySession as jest.Mock).mockResolvedValue([graded('q0'), graded('q1'), graded('q1', 't2')]);

    const result = await service.listForTeam('s1', 't1');

    expect(result).toEqual([
      expect.objectContaining({ questionId: 'q0', isCorrect: true, scoreAwarded: 3 }),
      expect.objectContaining({ questionId: 'q1', isCorrect: null, scoreAwarded: 0 }),
    ]);
  });

  it('includes the current grade once the timer and grace period have run out', async () => {
    const { service, answers } = buildHarness({ session: { question_ends_at: new Date(Date.now() - 5_000).toISOString() } });
    (answers.listBySession as jest.Mock).mockResolvedValue([graded('q1')]);

    const [answer] = await service.listForTeam('s1', 't1');

    expect(answer).toMatchObject({ isCorrect: true, scoreAwarded: 3 });
  });

  it('includes the current grade after the host reveals the answer', async () => {
    const { service, answers } = buildHarness({ session: { status: 'QUESTION_REVEAL' } });
    (answers.listBySession as jest.Mock).mockResolvedValue([graded('q1')]);

    const [answer] = await service.listForTeam('s1', 't1');

    expect(answer).toMatchObject({ isCorrect: true, scoreAwarded: 3 });
  });
});
