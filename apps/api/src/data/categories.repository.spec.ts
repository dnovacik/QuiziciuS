import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { CategoryRecord, SupabaseCategoriesRepository } from './categories.repository';

const RECORDS: CategoryRecord[] = [
  { id: 'cat1', name: 'General Knowledge' },
  { id: 'cat2', name: 'Sports' },
];

describe('SupabaseCategoriesRepository', () => {
  it('lists all categories', async () => {
    const supabase = fakeSupabaseService({ categories: { data: RECORDS, error: null } });
    const repo = new SupabaseCategoriesRepository(supabase);

    await expect(repo.list()).resolves.toEqual(RECORDS);
  });
});
