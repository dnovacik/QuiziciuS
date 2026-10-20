import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseQuestionsRepository, QuestionRecord } from './questions.repository';

const RECORD: QuestionRecord = {
  id: 'q1',
  quiz_id: 'quiz1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Capital of France?',
  options: [{ id: 'a', label: 'Paris', isCorrect: true }],
  accepted_answers: null,
  correct_numeric: null,
  points: 1,
  time_limit_seconds: 30,
  order_index: 0,
};

describe('SupabaseQuestionsRepository', () => {
  it('creates a question under a quiz', async () => {
    const supabase = fakeSupabaseService({ questions: { data: RECORD, error: null } });
    const repo = new SupabaseQuestionsRepository(supabase);

    const { id, quiz_id, ...input } = RECORD;
    await expect(repo.create('quiz1', input)).resolves.toEqual(RECORD);
  });

  it('lists questions for a quiz', async () => {
    const supabase = fakeSupabaseService({ questions: { data: [RECORD], error: null } });
    const repo = new SupabaseQuestionsRepository(supabase);

    await expect(repo.listByQuiz('quiz1')).resolves.toEqual([RECORD]);
  });
});
