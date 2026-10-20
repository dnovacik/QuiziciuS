# QuiziciuS implementation progress

Updated: 2026-10-20

## Decisions (locked)
- Default language **Slovak (sk)**; switchable to **English (en)**, preference stored locally.
- Existing NestJS + Supabase + React architecture stays.
- Registered team identity has a globally unique normalized name; captain account authenticates before joining.
- League memberships are league-scoped; teams compete across weekly nights with persistent results.
- Super-League qualification: **top 3 eligible teams per pub from finalized local season standings**.
- Championship: **single venue**, using the existing quiz engine.
- Each work package goes through its own PR. Owner performs local acceptance testing before merge.

## Work packages
| PR/work package | State | User verification |
|---|---|---|
| 01 — i18n foundation + tracker | IN PROGRESS | Homepage defaults to SK, language switch persists EN/SK; tests/build |
| 02 — team identity specification + auth migrations | TODO | Register, log in, reserved-name conflict, recovery |
| 03 — team screens + authenticated joining | TODO | Login and join session, one active device |
| 04 — engine integrity + reconnection | TODO | Concurrent answers, stale transitions, reconnection |
| 05 — quiz builder + host controls + projector | TODO | Full 20-question local quiz night |
| 06 — venues + persistent teams + local leagues | TODO | Multiple rounds; season standings |
| 07 — Super-League qualification + championship | TODO | Three pubs x top three qualifiers |
| 08 — E2E hardening and pilot | TODO | Multi-device full event |

## UI inventory (mockup then implement)
Public: landing; login; team signup; recovery; competition directory.
Team: dashboard; join; lobby; question; result; history; settings; league memberships.
Host: dashboard; quiz library; builder; preview; event list; create/edit event; live controls; event results; venue list; venue staff; settings.
Local league: directory; create/edit; overview; season management; team registration; standings; schedule.
Super-League: directory; overview; participating pubs; qualifier manager; championship manager; results.
Projector: lobby; question/reveal; leaderboard/winner.

## Language quality gate
- Add UI strings to typed dictionaries; never hard-code user-facing text in new screens.
- Slovak is the fallback for missing/invalid or unavailable persisted locale.
- English translation coverage required for every new screen; include validation/errors and accessibility labels.
- Dates/numbers formatted using the chosen locale.
- No localized routes in MVP; identifiers and API payload enums remain language-neutral.

## Working agreement
PR branches are based on master; review + local verification before merge. Update this document in every PR with state, affected views, test command, and manual test instructions.
