-- Issue #40 follow-ups: atomic answer submission, a host-checked grade override, quiz rounds.

-- An answer is accepted only while its question is open. The session row is share-locked, so a
-- reveal (which updates that row) waits for submissions already in flight and refuses later ones:
-- numeric grading and the host's answer list at reveal then always see every accepted answer.
create or replace function submit_answer(
  p_session_id uuid, p_question_id uuid, p_team_id uuid, p_response jsonb, p_grace_ms integer
) returns answers
language plpgsql
security invoker
set search_path = public
as $$
declare
  open_session quiz_sessions%rowtype;
  saved answers%rowtype;
begin
  select * into open_session from quiz_sessions where id = p_session_id for share;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if open_session.status <> 'QUESTION_ACTIVE' or open_session.current_question_id is distinct from p_question_id then
    raise exception 'QUESTION_NOT_ACTIVE';
  end if;
  if open_session.question_ends_at is not null and open_session.question_paused_at is null
     and clock_timestamp() > open_session.question_ends_at + make_interval(secs => p_grace_ms / 1000.0) then
    raise exception 'SUBMISSION_CLOSED';
  end if;
  insert into answers (session_id, question_id, team_id, response, submitted_at)
  values (p_session_id, p_question_id, p_team_id, p_response, clock_timestamp())
  on conflict (session_id, question_id, team_id)
  do update set response = excluded.response, submitted_at = excluded.submitted_at
  returning * into saved;
  return saved;
end;
$$;
revoke all on function submit_answer(uuid, uuid, uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function submit_answer(uuid, uuid, uuid, jsonb, integer) to service_role;

-- The override also checks that the host runs the answer's session, so the audit row cannot name
-- anyone else; like the other RPCs it is for the API's service role only.
create or replace function override_answer_grade(
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
  perform 1 from quiz_sessions where id = previous.session_id and host_id = p_host_id;
  if not found then raise exception 'Not your session'; end if;
  update answers
  set is_correct = p_correct, score_awarded = p_points, needs_review = false,
      graded_by = 'HOST', graded_at = now()
  where id = p_answer_id returning * into changed;
  insert into answer_grade_audit (answer_id, host_id, previous_correct, new_correct, previous_points, new_points)
  values (p_answer_id, p_host_id, previous.is_correct, p_correct, previous.score_awarded, p_points);
  return changed;
end;
$$;
revoke all on function override_answer_grade(uuid, uuid, boolean, integer) from public, anon, authenticated;
grant execute on function override_answer_grade(uuid, uuid, boolean, integer) to service_role;

-- Rounds lay over the question order: [{ "title": "Music", "questionCount": 10, "breakMinutes": 10 }].
-- After the last question of a round (except the final one) the host is offered that coffee break.
alter table quizzes add column rounds jsonb not null default '[]'::jsonb;
