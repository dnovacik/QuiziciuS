-- Quiz defaults, numeric units and table numbers.
-- A quiz's default answer time is used for its new questions (0 = no timer).
-- A numeric question can name its unit (years, km, %), shown to players and on the projector.
-- A team can say which table it sits at, so the host can find it in the room.
alter table public.quizzes
  add column default_time_limit_seconds integer not null default 30
    check (default_time_limit_seconds between 0 and 3600);

alter table public.questions
  add column unit text check (char_length(unit) <= 20);

alter table public.teams
  add column table_number text check (char_length(table_number) <= 10);
