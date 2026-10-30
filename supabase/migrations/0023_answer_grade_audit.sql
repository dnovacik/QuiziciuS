-- Host corrections are written atomically with an immutable audit record.
create table answer_grade_audit (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answers(id) on delete cascade,
  host_id uuid not null,
  previous_correct boolean,
  new_correct boolean not null,
  previous_points integer not null,
  new_points integer not null,
  created_at timestamptz not null default now()
);

create index answer_grade_audit_answer_idx on answer_grade_audit (answer_id, created_at);

alter table answer_grade_audit enable row level security;

create function override_answer_grade(
  p_answer_id uuid, p_host_id uuid, p_correct boolean, p_points integer
) returns answers
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous answers%rowtype;
  changed answers%rowtype;
begin
  select * into previous from answers where id = p_answer_id for update;
  if not found then raise exception 'Answer not found'; end if;
  update answers
  set is_correct = p_correct, score_awarded = p_points, needs_review = false,
      graded_by = 'HOST', graded_at = now()
  where id = p_answer_id returning * into changed;
  insert into answer_grade_audit (answer_id, host_id, previous_correct, new_correct, previous_points, new_points)
  values (p_answer_id, p_host_id, previous.is_correct, p_correct, previous.score_awarded, p_points);
  return changed;
end;
$$;
