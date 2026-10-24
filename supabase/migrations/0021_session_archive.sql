-- A finished quiz night the host has filed away: hidden from the sessions list by default.
-- Its results, exports and league standings stay as they are.
alter table public.quiz_sessions
  add column archived_at timestamptz;
