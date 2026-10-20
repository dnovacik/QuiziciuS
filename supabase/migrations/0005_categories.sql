create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (name)
);

alter table categories enable row level security;

alter table quizzes
  add column category_id uuid references categories(id) on delete set null;

insert into categories (name) values
  ('General Knowledge'),
  ('Sports'),
  ('History'),
  ('Geography'),
  ('Science & Nature'),
  ('Art & Literature'),
  ('Film & TV'),
  ('Music'),
  ('Food & Drink'),
  ('Technology'),
  ('Pop Culture')
on conflict (name) do nothing;
