import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { ScoreAdjustmentRecord, SupabaseScoreAdjustmentsRepository } from './score-adjustments.repository';

const RECORD: ScoreAdjustmentRecord = {
  id: 'adj1',
  session_id: 's1',
  team_id: 't1',
  points: 3,
  reason: 'Paper round 2',
  created_at: '2026-09-16T00:00:00.000Z',
};

describe('SupabaseScoreAdjustmentsRepository', () => {
  it('creates a score adjustment', async () => {
    const supabase = fakeSupabaseService({ score_adjustments: { data: RECORD, error: null } });
    const repo = new SupabaseScoreAdjustmentsRepository(supabase);

    await expect(repo.create('s1', 't1', 3, 'Paper round 2')).resolves.toEqual(RECORD);
  });

  it('lists adjustments for a session', async () => {
    const supabase = fakeSupabaseService({ score_adjustments: { data: [RECORD], error: null } });
    const repo = new SupabaseScoreAdjustmentsRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });
});
