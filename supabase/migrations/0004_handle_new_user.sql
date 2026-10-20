-- Create a `public.profiles` row for every new `auth.users` row.
--
-- `quizzes.host_id` and `quiz_sessions.host_id` both reference `profiles(id)`,
-- but nothing previously inserted into `profiles`. A freshly signed-up host's
-- first quiz-creation attempt therefore failed on a foreign-key violation.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
