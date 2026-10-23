-- Leagues: hosts propose a league for their pubs, invite other hosts and the teams of those pubs,
-- tick quiz nights for it, and close it into a frozen table. A SUPER league is the final between
-- the top 3 per pub of a closed league, scored by raw quiz points.
-- See docs/superpowers/specs/2026-10-23-leagues-design.md.

-- The prototype's `leagues` table (0001) and `quizzes.league_id` were never used; a league is now
-- attached to quiz nights, not to quizzes.
alter table quizzes drop column league_id;
drop table leagues;

create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 60),
  kind text not null default 'LEAGUE' check (kind in ('LEAGUE', 'SUPER')),
  owner_host_id uuid not null references auth.users(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  message text check (message is null or char_length(message) <= 500),
  parent_league_id uuid references leagues(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index leagues_owner_idx on leagues(owner_host_id);
-- One Super League per closed league.
create unique index leagues_parent_idx on leagues(parent_league_id) where parent_league_id is not null;

create table league_hosts (
  league_id uuid not null references leagues(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('INVITED', 'ACCEPTED', 'DECLINED')),
  responded_at timestamptz,
  primary key (league_id, host_id)
);
create index league_hosts_host_idx on league_hosts(host_id);

create table league_pubs (
  league_id uuid not null references leagues(id) on delete cascade,
  pub_id uuid not null references pubs(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  primary key (league_id, pub_id)
);

create table league_teams (
  league_id uuid not null references leagues(id) on delete cascade,
  registered_team_id uuid not null references registered_teams(id) on delete cascade,
  status text not null check (status in ('INVITED', 'JOINED', 'DECLINED')),
  -- The pub the team represents for qualification, fixed when it joins (season snapshot).
  pub_id uuid references pubs(id) on delete set null,
  joined_at timestamptz,
  primary key (league_id, registered_team_id)
);
create index league_teams_team_idx on league_teams(registered_team_id);

-- Frozen standings, written when a league closes; later score corrections do not change them.
create table league_results (
  league_id uuid not null references leagues(id) on delete cascade,
  registered_team_id uuid references registered_teams(id) on delete set null,
  team_name text not null,
  pub_id uuid references pubs(id) on delete set null,
  rank integer not null,
  points integer not null,
  nights integer not null,
  placements integer[] not null default '{}'
);
create index league_results_league_idx on league_results(league_id);

alter table quiz_sessions add column league_id uuid references leagues(id) on delete set null;
create index quiz_sessions_league_idx on quiz_sessions(league_id);

alter table leagues enable row level security;
alter table league_hosts enable row level security;
alter table league_pubs enable row level security;
alter table league_teams enable row level security;
alter table league_results enable row level security;
