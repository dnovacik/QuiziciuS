-- The questions a quiz night has shown, in order, kept with the session so every device the host
-- runs it from (laptop, phone remote) agrees which question comes next.
alter table public.quiz_sessions
  add column played_question_ids uuid[] not null default '{}';
