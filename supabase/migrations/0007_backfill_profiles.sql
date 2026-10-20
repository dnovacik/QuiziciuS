-- 0004_handle_new_user.sql's trigger only fires on new auth.users inserts.
-- Any account created before that migration was applied (or before this
-- database had migrations applied at all) has no matching profiles row,
-- which trips the quizzes.host_id/quiz_sessions.host_id foreign key the
-- first time that host tries to create anything. One-time backfill, safe
-- to re-run.

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'display_name', u.email, 'Host')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
