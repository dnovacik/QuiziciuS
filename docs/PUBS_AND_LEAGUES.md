# Pubs, teams and leagues

## What exists (migration `0011_pubs.sql`)

- **Pubs are shared.** One `pubs` row per real place, unique by normalised name + city. A host who
  adds a pub another host already created gets the existing row; `host_pubs` is each host's own
  venue list, and removing a pub there never deletes the pub.
- **Quizzes and sessions have a pub.** `quizzes.pub_id` is the default; `quiz_sessions.pub_id` is
  where the night is actually played (picked when launching, defaulting to the quiz's pub).
- **Teams play at several pubs, one is primary.** `registered_team_pubs` holds up to 5 pubs per
  registered team; exactly one is `is_primary` (enforced by a partial unique index).
- **Session teams are linked to registered teams.** When a captain joins from `/team`,
  `teams.registered_team_id` is set. One-off teams cannot take that name in the same session.

## League decisions already made

Carried over from the earlier project tracker (marked "locked" there):

- League memberships are league-scoped; teams compete across weekly nights with persistent results.
- **Super League qualification:** the top 3 eligible teams per pub, taken from the finalized local
  season standings.
- **Championship:** played at a single venue, using the existing quiz engine.

## Leagues (built 2026-10-23, migration `0015_leagues.sql`)

Full design: `docs/superpowers/specs/2026-10-23-leagues-design.md`. In short:

- **Seasons are flexible.** A host proposes a league for their pubs (`/host/leagues`) with a start
  date and an indicative end date; several leagues a year are fine. Other hosts can be invited
  and join with their own pubs. There is no chat — the proposal carries a short message.
- **Teams are invited** when the league is created (or a co-host accepts): registered teams that
  have one of the league's pubs, or have played a finished night there. Captains join or decline
  on the team page. **Playing a league night makes a team a member**, even after declining.
- **A night counts only when the host ticks it** at launch ("Táto noc sa počíta do ligy").
- **One-off teams** on a league night are offered registration on their phone until the first
  question starts; the host sees who is unregistered in the lobby. Unregistered teams are left out
  of league placing.
- **Scoring** of a league night is by placing among registered teams: 10, 8, 6, 5, 4, 3, 2, 1, then
  0; ties share the better place. Table tie-break: more 1st places, then 2nd, …, then fewer nights.
- **The pub a team represents** is fixed when it joins: its primary pub if that is a league pub,
  otherwise the league pub where it first played — so changing the primary pub mid-season does not
  move it.
- **Closing** (owner, any time; prompted after the end date) freezes the table into
  `league_results`. The **top 3 per pub** qualify; "Vytvoriť Super ligu" creates the final, which
  only the qualified teams play and which is scored by **raw quiz points**.

Not built yet: notifications (invitations show in the app only), standings on the projector,
regional Super Leagues across several seasons, configurable scoring.
