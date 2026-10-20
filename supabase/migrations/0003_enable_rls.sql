-- Close direct PostgREST access to every table.
--
-- The web bundle ships the Supabase anon key (it is needed for Realtime auth),
-- so without RLS anyone who reads that key out of the bundle can read and write
-- every table through PostgREST, bypassing the "all reads/writes go through
-- NestJS" design entirely.
--
-- Enabling RLS with ZERO policies is intentionally deny-all for the `anon` and
-- `authenticated` roles. The NestJS backend uses a service-role Supabase client,
-- which bypasses RLS entirely, so no API change is required. Curated per-row
-- policies are deliberately out of scope for Phase 1 — the goal here is closing
-- direct access, not opening a second, parallel access path.

alter table profiles enable row level security;
alter table leagues enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table quiz_sessions enable row level security;
alter table teams enable row level security;
alter table answers enable row level security;
alter table infractions enable row level security;
alter table score_adjustments enable row level security;
