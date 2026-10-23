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

## How leagues should use this (not built yet)

Results are recorded per session, so standings can be derived without asking teams anything:

| League | Scope | Which results count |
|---|---|---|
| Pub league | one pub, one season | every linked session team result in sessions played at that pub |
| Super league | all pubs (or a region), one season | each registered team counts **once**, under its **primary pub** |

Why several pubs do not clash:

- In **pub leagues** a team simply appears in every pub's table where it actually played. Playing
  at two pubs is normal and harmless — each table only sees its own pub's sessions.
- In the **super league** a team must not qualify or be counted twice. The primary pub decides
  which pub the team represents, and the team's super-league score is its own results (e.g. best
  N sessions across all pubs), not the sum of two pub-league placings.
- **Changing the primary pub mid-season** should be locked or only take effect next season;
  otherwise a team could switch to whichever pub gives it a better qualifying spot. Suggested rule:
  store the primary pub per season (`league_memberships(season_id, team_id, pub_id)`) when the
  season starts.

Open decisions before building leagues: season boundaries, the scoring formula (points per
placing vs. raw score, best N of M nights), what makes a team "eligible" (registered, a minimum
number of nights), and whether one-off (unregistered) teams appear in pub tables. Qualification
itself is decided: the top 3 per pub, with each team qualifying only through its primary pub.
