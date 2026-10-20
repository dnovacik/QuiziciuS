create table score_adjustments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  points integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index score_adjustments_session_idx on score_adjustments (session_id);
