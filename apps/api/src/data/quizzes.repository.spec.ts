import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { QuizRecord, SupabaseQuizzesRepository } from './quizzes.repository';

const RECORD: QuizRecord = {
  id: 'quiz1',
  host_id: 'host1',
  category_id: null,
  pub_id: null,
  title: 'Wednesday Night Quiz',
  created_at: '2026-09-16T00:00:00.000Z',
};

describe('SupabaseQuizzesRepository', () => {
  it('creates a quiz owned by the host with no category', async () => {
    const supabase = fakeSupabaseService({ quizzes: { data: RECORD, error: null } });
    const repo = new SupabaseQuizzesRepository(supabase);

    await expect(repo.create('host1', 'Wednesday Night Quiz', null)).resolves.toEqual(RECORD);
  });

  it('creates a quiz with a category', async () => {
    const withCategory = { ...RECORD, category_id: 'cat1' };
    const supabase = fakeSupabaseService({ quizzes: { data: withCategory, error: null } });
    const repo = new SupabaseQuizzesRepository(supabase);

    await expect(repo.create('host1', 'Wednesday Night Quiz', 'cat1')).resolves.toEqual(withCategory);
  });

  it('lists quizzes for a host', async () => {
    const supabase = fakeSupabaseService({ quizzes: { data: [RECORD], error: null } });
    const repo = new SupabaseQuizzesRepository(supabase);

    await expect(repo.listByHost('host1')).resolves.toEqual([RECORD]);
  });
});
