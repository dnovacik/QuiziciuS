-- Persistent globally identified teams are separate from transient quiz-session teams.
create table registered_teams (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  description text,
  badge text not null default 'shield',
  badge_color text not null default 'purple',
  expected_members smallint not null default 4 check (expected_members between 2 and 6),
  home_pub text,
  created_at timestamptz not null default now(),
  constraint registered_team_name_length check (char_length(btrim(name)) between 3 and 30),
  constraint registered_team_name_unique unique (normalized_name)
);
create index registered_teams_captain_idx on registered_teams(captain_id);
create table registered_team_members (
  team_id uuid not null references registered_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('captain','member')),
  joined_at timestamptz not null default now(),
  primary key (team_id,user_id)
);
create unique index registered_team_single_captain_idx on registered_team_members(team_id) where role='captain';
create or replace function create_registered_team(
  p_captain uuid, p_name text, p_description text, p_badge text, p_color text, p_members smallint, p_home_pub text
) returns registered_teams language plpgsql security definer set search_path=public as $$
declare v_team registered_teams;
begin
  if char_length(btrim(p_name)) < 3 or char_length(btrim(p_name)) > 30 then
    raise exception 'Invalid team name' using errcode='22023';
  end if;
  insert into registered_teams(captain_id,name,description,badge,badge_color,expected_members,home_pub)
  values (p_captain,btrim(p_name),nullif(btrim(p_description),''),p_badge,p_color,p_members,nullif(btrim(p_home_pub),''))
  returning * into v_team;
  insert into registered_team_members(team_id,user_id,role) values (v_team.id,p_captain,'captain');
  return v_team;
end;$$;
revoke all on function create_registered_team(uuid,text,text,text,text,smallint,text) from public, anon, authenticated;
grant execute on function create_registered_team(uuid,text,text,text,text,smallint,text) to service_role;
alter table registered_teams enable row level security;
alter table registered_team_members enable row level security;
