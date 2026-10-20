create type quiz_state as enum (
  'LOBBY', 'LOCK_IN_ROUND', 'QUESTION_ACTIVE', 'QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED'
);

create type question_type as enum (
  'MULTIPLE_CHOICE', 'FREE_TEXT', 'NUMERIC_NEAREST'
);

create type infraction_type as enum (
  'VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT', 'WAKE_LOCK_LOST'
);

create type grader as enum ('AUTO', 'HOST');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table leagues (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  league_id uuid references leagues(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  type question_type not null,
  prompt text not null,
  options jsonb,
  accepted_answers text[],
  correct_numeric numeric,
  points integer not null default 1,
  time_limit_seconds integer not null default 30,
  order_index integer not null,
  created_at timestamptz not null default now()
);

create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  host_id uuid not null references profiles(id) on delete cascade,
  join_code text not null,
  status quiz_state not null default 'LOBBY',
  current_question_id uuid references questions(id),
  question_ends_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- Join codes only need to be unique among sessions that are still joinable.
create unique index quiz_sessions_join_code_active_idx
  on quiz_sessions (join_code)
  where status <> 'FINISHED';

create table teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  name text not null,
  device_token_hash text,
  joined_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (session_id, name)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  response jsonb not null,
  is_correct boolean,
  confidence numeric,
  needs_review boolean not null default false,
  graded_by grader,
  graded_at timestamptz,
  submitted_at timestamptz not null default now(),
  score_awarded integer not null default 0,
  unique (session_id, question_id, team_id)
);

create table infractions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  type infraction_type not null,
  detected_at timestamptz not null default now(),
  reviewed boolean not null default false
);

create index answers_session_needs_review_idx on answers (session_id) where needs_review;
create index infractions_session_idx on infractions (session_id);
