import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { QuizRecord, SupabaseQuizzesRepository } from './quizzes.repository';

const RECORD: QuizRecord = {
  id: 'quiz1',
  host_id: 'host1',
  league_id: null,
  title: 'Wednesday Night Quiz',
  created_at: '2026-09-16T00:00:00.000Z',
};

describe('SupabaseQuizzesRepository', () => {
  it('creates a quiz owned by the host', async () => {
    const supabase = fakeSupabaseService({ quizzes: { data: RECORD, error: null } });
    const repo = new SupabaseQuizzesRepository(supabase);

    await expect(repo.create('host1', 'Wednesday Night Quiz')).resolves.toEqual(RECORD);
  });

  it('lists quizzes for a host', async () => {
    const supabase = fakeSupabaseService({ quizzes: { data: [RECORD], error: null } });
    const repo = new SupabaseQuizzesRepository(supabase);

    await expect(repo.listByHost('host1')).resolves.toEqual([RECORD]);
  });
});
