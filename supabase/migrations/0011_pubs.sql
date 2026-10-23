-- Pubs are shared venue records: one row per real place, reused by every host who
-- quizzes there and every team that plays there. A pub is identified by its
-- normalised name + city, so two hosts adding "U Zlatého leva, Žilina" get one row.
create table pubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  city text not null check (char_length(btrim(city)) between 2 and 60),
  address text check (address is null or char_length(address) <= 160),
  normalized_key text generated always as (lower(btrim(name)) || '|' || lower(btrim(city))) stored,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pubs_normalized_key_unique unique (normalized_key)
);

-- The pubs a host runs quizzes at (their venue list). Unlinking never deletes the pub.
create table host_pubs (
  host_id uuid not null references profiles(id) on delete cascade,
  pub_id uuid not null references pubs(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (host_id, pub_id)
);

-- A registered team can play at several pubs; exactly one of them is its primary pub,
-- which is the pub the team represents in league / super-league standings.
create table registered_team_pubs (
  team_id uuid not null references registered_teams(id) on delete cascade,
  pub_id uuid not null references pubs(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (team_id, pub_id)
);
create unique index registered_team_pubs_primary_idx on registered_team_pubs(team_id) where is_primary;
create index registered_team_pubs_pub_idx on registered_team_pubs(pub_id);

-- Default venue of a quiz, and the venue a session is actually played at.
alter table quizzes add column pub_id uuid references pubs(id) on delete set null;
alter table quiz_sessions add column pub_id uuid references pubs(id) on delete set null;
create index quiz_sessions_pub_idx on quiz_sessions(pub_id);

-- A session team joined by a registered team's captain is linked to it, which is what
-- league standings and the team's match history are built from. The free-text
-- registered_teams.home_pub column is superseded by registered_team_pubs and kept only
-- so existing values are not lost.
alter table teams add column registered_team_id uuid references registered_teams(id) on delete set null;
create unique index teams_session_registered_team_idx on teams(session_id, registered_team_id) where registered_team_id is not null;
comment on column registered_teams.home_pub is 'Deprecated: superseded by registered_team_pubs.';

-- Replace a team's pubs atomically. p_primary must be one of p_pubs (or null when empty).
create or replace function set_registered_team_pubs(p_team uuid, p_pubs uuid[], p_primary uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if coalesce(array_length(p_pubs, 1), 0) > 5 then
    raise exception 'Too many pubs' using errcode='22023';
  end if;
  if coalesce(array_length(p_pubs, 1), 0) > 0 and (p_primary is null or not (p_primary = any(p_pubs))) then
    raise exception 'Primary pub must be one of the team pubs' using errcode='22023';
  end if;
  perform 1 from registered_teams where id = p_team for update;
  delete from registered_team_pubs where team_id = p_team;
  insert into registered_team_pubs(team_id, pub_id, is_primary)
  select p_team, pub, pub = p_primary from unnest(p_pubs) as pub;
end $$;
revoke all on function set_registered_team_pubs(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function set_registered_team_pubs(uuid, uuid[], uuid) to service_role;

alter table pubs enable row level security;
alter table host_pubs enable row level security;
alter table registered_team_pubs enable row level security;
