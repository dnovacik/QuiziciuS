-- Account levels: SUPER_ADMIN (platform owners), HOST (created by a super admin) and
-- TEAM_CAPTAIN (self-registered). Supabase sign-up stays open because captains register
-- themselves, so every new account starts as TEAM_CAPTAIN and only the API (service role,
-- super admin only) can change a role. The role is never read from user_metadata, which
-- users can edit.
create type account_role as enum ('SUPER_ADMIN', 'HOST', 'TEAM_CAPTAIN');

alter table profiles add column role account_role not null default 'TEAM_CAPTAIN';
-- Mirrors auth.users.email so the admin can list hosts without the auth admin API.
alter table profiles add column email text;
-- Set when a super admin deactivates a host: they keep their data but cannot launch quiz nights.
alter table profiles add column deactivated_at timestamptz;
create index profiles_role_idx on profiles(role);

update profiles p set email = u.email from auth.users u where u.id = p.id;

-- Accounts that already host quizzes keep hosting.
update profiles set role = 'HOST'
where id in (select host_id from quizzes union select host_id from quiz_sessions);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  execute function public.handle_user_email_change();

-- The first super admin is set by hand once (see docs/ACCOUNTS.md):
--   update profiles set role = 'SUPER_ADMIN' where email = '<owner e-mail>';
