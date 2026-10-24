-- How teammates reach a registered team without accounts of their own:
-- access_pin   6 digits the captain hands out; a phone that knows it can play a quiz night as the team.
-- invite_token a link the captain shares; whoever opens it can add their name to the roster.
-- Both are created on first use and can be replaced by the captain at any time.
alter table public.registered_teams
  add column access_pin text check (access_pin ~ '^[0-9]{6}$'),
  add column invite_token text unique check (char_length(invite_token) between 16 and 64);
