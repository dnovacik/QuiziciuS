import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { RegisteredTeamRecord, SupabaseRegisteredTeamsRepository } from './registered-teams.repository';

const TEAM: RegisteredTeamRecord = {
  id: 'rt1',
  captain_id: 'c1',
  name: 'Wise Ducks',
  normalized_name: 'wise ducks',
  description: null,
  badge: 'shield',
  badge_color: 'purple',
  expected_members: 4,
  home_pub: null,
  created_at: '2026-10-20T18:00:00.000Z',
};

const NEW_TEAM = { captainId: 'c1', name: 'Wise Ducks', description: '', badge: 'shield', color: 'purple', expectedMembers: 4 };

function repo(results: Parameters<typeof fakeSupabaseService>[0]) {
  return new SupabaseRegisteredTeamsRepository(fakeSupabaseService(results));
}

describe('SupabaseRegisteredTeamsRepository', () => {
  it('creates a team through the database function', async () => {
    await expect(repo({ 'rpc:create_registered_team': { data: TEAM, error: null } }).create(NEW_TEAM)).resolves.toEqual(TEAM);
  });

  it('reports a duplicate team name as NAME_TAKEN', async () => {
    const duplicate = repo({ 'rpc:create_registered_team': { data: null, error: { code: '23505', message: 'duplicate key' } } });

    await expect(duplicate.create(NEW_TEAM)).rejects.toMatchObject({ status: 409, response: { code: 'NAME_TAKEN' } });
  });

  it('reports a name the database rejects as INVALID_NAME', async () => {
    const invalid = repo({ 'rpc:create_registered_team': { data: null, error: { code: '22023', message: 'Invalid team name' } } });

    await expect(invalid.create(NEW_TEAM)).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_NAME' } });
  });

  it('tells a full roster apart from an invalid player name', async () => {
    const full = repo({ 'rpc:add_registered_team_player': { data: null, error: { code: '22023', message: 'Roster full' } } });
    const invalid = repo({ 'rpc:add_registered_team_player': { data: null, error: { code: '22023', message: 'Invalid player name' } } });

    await expect(full.addPlayer('rt1', 'c1', 'Anna')).rejects.toMatchObject({ response: { code: 'ROSTER_FULL' } });
    await expect(invalid.addPlayer('rt1', 'c1', '')).rejects.toMatchObject({ response: { code: 'INVALID_PLAYER' } });
  });

  it('reports a duplicate player as PLAYER_EXISTS and a foreign team as NOT_CAPTAIN', async () => {
    const duplicate = repo({ 'rpc:add_registered_team_player': { data: null, error: { code: '23505', message: 'duplicate key' } } });
    const foreign = repo({ 'rpc:add_registered_team_player': { data: null, error: { code: '42501', message: 'Not team captain' } } });

    await expect(duplicate.addPlayer('rt1', 'c1', 'Anna')).rejects.toMatchObject({ status: 409, response: { code: 'PLAYER_EXISTS' } });
    await expect(foreign.addPlayer('rt1', 'c2', 'Anna')).rejects.toMatchObject({ status: 403, response: { code: 'NOT_CAPTAIN' } });
  });

  it('returns only the public player fields', async () => {
    const player = { id: 'p1', team_id: 'rt1', name: 'Anna', created_at: '2026-10-20T18:00:00.000Z' };
    const added = repo({ 'rpc:add_registered_team_player': { data: player, error: null } });

    await expect(added.addPlayer('rt1', 'c1', 'Anna')).resolves.toEqual({ id: 'p1', name: 'Anna', created_at: player.created_at });
  });

  it('reports a rename to a taken name as NAME_TAKEN', async () => {
    const duplicate = repo({ registered_teams: { data: null, error: { code: '23505', message: 'duplicate key' } } });

    await expect(duplicate.update('rt1', { name: 'Quiz Owls' })).rejects.toMatchObject({ response: { code: 'NAME_TAKEN' } });
  });

  it('says whether a player was actually removed', async () => {
    await expect(repo({ registered_team_players: { data: { id: 'p1' }, error: null } }).removePlayer('rt1', 'p1')).resolves.toBe(true);
    await expect(repo({ registered_team_players: { data: null, error: null } }).removePlayer('rt1', 'p1')).resolves.toBe(false);
  });

  it('answers whether a name is taken', async () => {
    await expect(repo({ registered_teams: { data: [{ id: 'rt1' }], error: null } }).isNameTaken('Wise Ducks')).resolves.toBe(true);
    await expect(repo({ registered_teams: { data: [], error: null } }).isNameTaken('Quiz Owls')).resolves.toBe(false);
  });

  it('turns other database errors into a server error', async () => {
    const broken = repo({ registered_teams: { data: null, error: { message: 'connection reset' } } });

    await expect(broken.findById('rt1')).rejects.toMatchObject({ status: 500 });
  });
});
