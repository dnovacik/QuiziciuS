import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseTeamsRepository, TeamRecord } from './teams.repository';

const RECORD: TeamRecord = {
  id: 't1',
  session_id: 's1',
  name: 'The Quizzards',
  device_token_hash: 'hash-1',
  joined_at: '2026-09-16T00:00:00.000Z',
  is_active: true,
  registered_team_id: null,
  ready_question_id: null,
  ready_fullscreen: false,
};

describe('SupabaseTeamsRepository', () => {
  it('upserts a join, reactivating an existing team by name', async () => {
    const supabase = fakeSupabaseService({ teams: { data: RECORD, error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.upsertJoin('s1', 'The Quizzards')).resolves.toEqual(RECORD);
  });

  it('stamps the device token hash after a team id is known', async () => {
    const withHash = { ...RECORD, device_token_hash: 'hash-1' };
    const supabase = fakeSupabaseService({ teams: { data: withHash, error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.setDeviceTokenHash('t1', 'hash-1')).resolves.toEqual(withHash);
  });

  it('lists teams for a session', async () => {
    const supabase = fakeSupabaseService({ teams: { data: [RECORD], error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });

  it('finds a team by id', async () => {
    const supabase = fakeSupabaseService({ teams: { data: RECORD, error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.findById('t1')).resolves.toEqual(RECORD);
  });
});
