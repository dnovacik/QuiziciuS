-- "We're ready" from the player's lock-in screen. Readiness is stored per question, so it
-- resets by itself when the host locks in the next question.
alter table teams add column ready_question_id uuid references questions(id) on delete set null;
-- False when the team tapped ready but the browser refused fullscreen (e.g. iPhone Safari),
-- so the host can see that the anti-cheat fullscreen check is not active for that team.
alter table teams add column ready_fullscreen boolean not null default false;
