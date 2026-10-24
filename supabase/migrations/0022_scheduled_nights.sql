-- Quiz nights a host plans ahead: when, at which pub, optionally which quiz, and a note.
-- Captains see the upcoming ones at their teams' pubs. Read and written only through the API.
create table scheduled_nights (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  pub_id uuid not null references pubs(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete set null,
  starts_at timestamptz not null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index scheduled_nights_host_idx on scheduled_nights(host_id, starts_at);
create index scheduled_nights_pub_idx on scheduled_nights(pub_id, starts_at);
alter table scheduled_nights enable row level security;
