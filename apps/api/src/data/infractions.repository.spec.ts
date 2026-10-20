import { InfractionType } from '@quizicius/shared-types';
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { InfractionRecord, SupabaseInfractionsRepository } from './infractions.repository';

const RECORD: InfractionRecord = {
  id: 'inf1',
  session_id: 's1',
  team_id: 't1',
  type: 'VISIBILITY_HIDDEN' as InfractionType,
  detected_at: '2026-09-16T00:00:00.000Z',
  reviewed: false,
};

describe('SupabaseInfractionsRepository', () => {
  it('creates an infraction record', async () => {
    const supabase = fakeSupabaseService({ infractions: { data: RECORD, error: null } });
    const repo = new SupabaseInfractionsRepository(supabase);

    await expect(repo.create('s1', 't1', 'VISIBILITY_HIDDEN')).resolves.toEqual(RECORD);
  });

  it('lists infractions for a session', async () => {
    const supabase = fakeSupabaseService({ infractions: { data: [RECORD], error: null } });
    const repo = new SupabaseInfractionsRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });
});
