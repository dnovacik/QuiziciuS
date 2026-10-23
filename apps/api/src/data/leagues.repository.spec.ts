import { SupabaseService } from '../supabase/supabase.service';
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { LeagueRecord, SupabaseLeaguesRepository } from './leagues.repository';

const LEAGUE: LeagueRecord = {
  id: 'l1',
  name: 'Zimná liga',
  kind: 'LEAGUE',
  owner_host_id: 'h1',
  starts_on: '2027-01-12',
  ends_on: '2027-03-30',
  message: null,
  parent_league_id: null,
  closed_at: null,
  created_at: '2026-10-23T10:00:00Z',
};

describe('SupabaseLeaguesRepository', () => {
  it('finds a league by id', async () => {
    const repo = new SupabaseLeaguesRepository(fakeSupabaseService({ leagues: { data: LEAGUE, error: null } }));

    await expect(repo.findById('l1')).resolves.toEqual(LEAGUE);
  });

  it('turns a database error into a server error', async () => {
    const repo = new SupabaseLeaguesRepository(fakeSupabaseService({ leagues: { data: null, error: { message: 'connection reset' } } }));

    await expect(repo.findById('l1')).rejects.toMatchObject({ status: 500 });
  });

  it('does not touch the database when there is nobody to invite', async () => {
    const from = jest.fn();
    const repo = new SupabaseLeaguesRepository({ getClient: () => ({ from }) } as unknown as SupabaseService);

    await repo.inviteTeams('l1', []);

    expect(from).not.toHaveBeenCalled();
  });
});
