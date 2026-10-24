import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseSessionsRepository, SessionRecord } from './sessions.repository';

const RECORD: SessionRecord = {
  id: 's1',
  quiz_id: 'q1',
  host_id: 'h1',
  join_code: 'AB12',
  pub_id: null,
  league_id: null,
  status: 'LOBBY',
  current_question_id: null,
  question_ends_at: null,
  question_paused_at: null,
  break_ends_at: null,
  break_message: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: null,
  finished_at: null,
};

describe('SupabaseSessionsRepository', () => {
  it('creates a session in LOBBY status', async () => {
    const supabase = fakeSupabaseService({ quiz_sessions: { data: RECORD, error: null } });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.create('q1', 'h1', 'AB12')).resolves.toEqual(RECORD);
  });

  it('returns null when a session is not found', async () => {
    const supabase = fakeSupabaseService({
      quiz_sessions: { data: null, error: { message: 'not found' } },
    });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.findById('missing')).resolves.toBeNull();
  });

  it('resolves a join code to its session', async () => {
    const supabase = fakeSupabaseService({ quiz_sessions: { data: RECORD, error: null } });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.findByJoinCode('AB12')).resolves.toEqual(RECORD);
  });

  it('returns null when no open session carries that join code', async () => {
    const supabase = fakeSupabaseService({
      quiz_sessions: { data: null, error: { message: 'no rows' } },
    });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.findByJoinCode('ZZZZ')).resolves.toBeNull();
  });

  it('applies a status patch', async () => {
    const updated = { ...RECORD, status: 'LOCK_IN_ROUND' as const };
    const supabase = fakeSupabaseService({ quiz_sessions: { data: updated, error: null } });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.updateStatus('s1', { status: 'LOCK_IN_ROUND' })).resolves.toEqual(updated);
  });
});
