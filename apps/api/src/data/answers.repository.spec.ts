import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseAnswersRepository, AnswerRecord } from './answers.repository';

const RECORD: AnswerRecord = {
  id: 'a1',
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
  disputed_at: null,
  dispute_note: null,
};

describe('SupabaseAnswersRepository', () => {
  it('saves a submission through the atomic submit function', async () => {
    const supabase = fakeSupabaseService({ 'rpc:submit_answer': { data: RECORD, error: null } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(
      repo.upsertSubmission({ sessionId: 's1', questionId: 'q1', teamId: 't1', response: { optionId: 'a' }, graceMs: 2000 }),
    ).resolves.toEqual(RECORD);
  });

  it('refuses a submission the database finds after the reveal', async () => {
    const supabase = fakeSupabaseService({ 'rpc:submit_answer': { data: null, error: { message: 'QUESTION_NOT_ACTIVE' } } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(
      repo.upsertSubmission({ sessionId: 's1', questionId: 'q1', teamId: 't1', response: { optionId: 'a' }, graceMs: 2000 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a submission past the deadline and its grace', async () => {
    const supabase = fakeSupabaseService({ 'rpc:submit_answer': { data: null, error: { message: 'SUBMISSION_CLOSED' } } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(
      repo.upsertSubmission({ sessionId: 's1', questionId: 'q1', teamId: 't1', response: { optionId: 'a' }, graceMs: 2000 }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('applies a grade patch', async () => {
    const graded = { ...RECORD, is_correct: true, graded_by: 'AUTO' as const, score_awarded: 1 };
    const supabase = fakeSupabaseService({ answers: { data: graded, error: null } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(repo.updateGrade('a1', { is_correct: true, graded_by: 'AUTO', score_awarded: 1 })).resolves.toEqual(graded);
  });
});

describe('SupabaseAnswersRepository.listBySession', () => {
  it('lists all answers for a session', async () => {
    const supabase = fakeSupabaseService({ answers: { data: [RECORD], error: null } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });
});
