-- This project's public schema never received Supabase's standard default
-- privilege grants (normal for a fresh, dashboard-provisioned project, but
-- missing here) — every table read via PostgREST, including from the
-- service-role key our own backend uses, was failing with "permission
-- denied for table ..." regardless of RLS. Grants control whether a role
-- can attempt an operation at all; RLS (enabled with zero policies in
-- 0003) is what actually denies anon/authenticated at the row level, and
-- service_role bypasses RLS by Supabase convention. So this grant is safe
-- to be broad — it doesn't reopen the anon-access hole 0003 closed.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
