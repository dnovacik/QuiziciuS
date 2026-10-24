-- Live-night controls.
-- Timer: a paused question keeps its deadline and records when it was paused; resuming moves the
-- deadline on by the time spent paused.
-- Break: an optional length and a message for the projector and phones.
-- Disputes: a team can dispute its graded answer once, with a short note for the host.
alter table public.quiz_sessions
  add column question_paused_at timestamptz,
  add column break_ends_at timestamptz,
  add column break_message text check (char_length(break_message) <= 200);

alter table public.answers
  add column disputed_at timestamptz,
  add column dispute_note text check (char_length(dispute_note) <= 200);
