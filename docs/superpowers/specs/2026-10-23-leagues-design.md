# Leagues — design

Status: draft for approval, 2026-10-23.
Builds on `docs/PUBS_AND_LEAGUES.md` (pubs, team pubs, linked session teams) and
`docs/ACCOUNTS.md` (roles, host subscriptions).

## Why

Hosts run weekly quiz nights at several pubs. Regular teams want their results to add up into
something: a season table, and at the end a final between the best teams of each pub (the
Super League). Today every night stands alone. Leagues give teams a reason to come back and give
hosts a reason to keep using QuiziciuS.

## Who decides what (from the conversation)

- **Seasons are not fixed.** Several per year, whenever hosts agree. A league has a start date and
  an indicative end date.
- **A host proposes a league** for one of their pubs (e.g. KC Hoffman). It is created at once; the
  proposal *is* the league in its preparation phase.
- **Teams are invited**: every registered team that has the league's pub among its pubs, or has
  played a finished quiz night there. Captains see the invitation on their team page and can join
  or decline.
- **Other hosts can be invited** (multi-select) to run the league with their own pubs. They accept
  or decline in their host area. When a host accepts, their pubs join the league and those pubs'
  teams are invited.
- **No chat.** The proposal carries a short message that invited hosts and captains read.
- **A night counts only when the host ticks it** at launch ("Táto noc sa počíta do ligy: …").
- **Playing is joining.** A registered team that plays a league night joins the league
  automatically, even if it never answered the invitation or declined it.
- **One-off (unregistered) teams** are told on their phone that it is a league night and offered to
  register. The host sees which teams are unregistered, live, and can tell the room. Registration is
  possible **only until the first question starts**. A team that does not register plays normally
  but is left out of league placing.
- **Scoring of a league night is by placing**, so hosts with different quizzes (50 × 1 point vs.
  30 × 2 points) are comparable: 1st 10, 2nd 8, 3rd 6, 4th 5, 5th 4, 6th 3, 7th 2, 8th 1, below 0.
  A missed night is 0.
- **Ending a season:** after the end date the proposing host is asked to close the league (or
  closes it earlier). Closing freezes the standings.
- **Super League:** a closed league offers "Vytvoriť Super ligu z tejto sezóny". The **top 3 per
  pub** qualify, each team only through its own pub (see Qualification). The Super League is
  **scored by raw quiz points**, because everyone plays the same quiz at one venue.

## Goals

- Hosts can propose, run and close leagues, invite co-hosts, mark nights as league nights, and see
  live standings.
- Captains see invitations and their leagues' standings on the team page.
- One-off teams on a league night are offered registration before the quiz starts.
- A closed league produces the qualified teams and can spawn its Super League.

## Non-goals (this round)

- Chat or threaded discussion between hosts.
- Push / e-mail notifications. Invitations are shown in the app (team page, host Ligy page). The
  notification bell stays "Čoskoro".
- Standings on the projector or the public landing page.
- Regional Super Leagues combining several seasons.
- Configurable scoring tables.

## Anti-goals (would make it a failure even if it works)

- A team getting league points twice for the same night, or qualifying through two pubs.
- A score correction after a night silently changing a **closed** league's final table.
- Blocking a quiz night from starting because of league bookkeeping. The host can always start.
- One-off players being pushed into registration mid-quiz. The offer disappears when the first
  question starts.

## Data model (migration `0015_leagues.sql`)

| Table / column | Purpose |
|---|---|
| `leagues` | `id, name, kind ('LEAGUE' \| 'SUPER'), owner_host_id, starts_on date, ends_on date, message text, parent_league_id (SUPER → source league), closed_at, created_at` |
| `league_hosts` | `league_id, host_id, status ('INVITED' \| 'ACCEPTED' \| 'DECLINED'), responded_at`. The owner is inserted as `ACCEPTED`. |
| `league_pubs` | `league_id, pub_id, host_id`: which host runs the league at which pub |
| `league_teams` | `league_id, registered_team_id, status ('INVITED' \| 'JOINED' \| 'DECLINED'), pub_id (the pub the team represents, see Qualification), joined_at` |
| `quiz_sessions.league_id` | the league this night counts for, or null |
| `league_results` | frozen table written when a league closes: `league_id, registered_team_id, team_name, pub_id, rank, points, nights, placements int[]` |

RLS deny-all like every other table; all access goes through the API.

## Rules in detail

### League phases

- **Pripravuje sa**: before `starts_on`. Invitations go out, hosts accept.
- **Prebieha**: from `starts_on` until closed. Nights can be ticked for it.
- **Ukončená**: `closed_at` set. No new nights; the standings come from `league_results`.

Only the owner edits the name, dates and message, and only the owner closes the league. Nights
can be ticked for a league in preparation too (my call: a host may start a week early).

### Ticking a night

The launch dialog offers the leagues where the host is `ACCEPTED`, the league is not closed, and
the selected pub is one of the league pubs run by that host. The API checks the same (`403
NOT_LEAGUE_HOST`, `400 PUB_NOT_IN_LEAGUE`, `409 LEAGUE_CLOSED`). The league cannot be changed after
the night has started (my call; avoids rewriting history mid-night).

### Joining by playing

When a session with a `league_id` reaches `FINISHED`, every linked registered team in it is upserted
into `league_teams` as `JOINED`. This overrides `INVITED` and `DECLINED`. It is also done lazily
when standings are computed, so a missed hook cannot lose anyone.

### One-off teams on a league night

- The player state (`GET /sessions/:id/state`) exposes `league: { id, name } | null`.
- While the session is in `LOBBY`, an unregistered team's phone shows a banner: "Toto je ligový
  večer — zaregistrujte tím a zbierajte body" with **Registrovať tím** / **Hrať bez registrácie**.
- **Registrovať tím** opens the existing captain sign-up / sign-in and team creation, pre-filled
  with the session team's name. It then calls a new endpoint that links the **existing session
  team** (identified by the team token on the phone) to the registered team. The phone keeps its
  seat and token. If the registered name differs (e.g. the name was taken), the session team is
  renamed to it. `409 REGISTRATION_CLOSED` once the session has left `LOBBY`.
- The host's lobby panel and control room mark unregistered teams ("neregistrovaný") and show a
  counter ("2 tímy nie sú v lige") on league nights.

### Night placing (kind LEAGUE)

For each finished league night:

1. Take the session's teams that are linked to a registered team. One-off teams are ignored.
2. Rank them by final score (the same score as the results screen: answers plus paper-score
   adjustments). Ties share the better place (1, 1, 3).
3. Points per place: 10, 8, 6, 5, 4, 3, 2, 1, then 0.

Standings = sum of points over the league's finished nights. Tie-break: more 1st places, then
more 2nd places, …, then fewer nights played, then name (my call).

### Super League scoring (kind SUPER)

Only teams in its `league_teams` (the qualified ones) count; others are ignored. Standings are the
sum of raw final scores over its nights (normally one final). Ties share the rank.

### Qualification

- When a team joins a league (by invitation or by playing), `league_teams.pub_id` is fixed:
  - the team's **primary pub** if it is one of the league's pubs;
  - otherwise the league pub where it first played.
  
  This is the season snapshot suggested in `PUBS_AND_LEAGUES.md`. Changing the primary pub later does
  not move the team.
- On close: the top 3 of the frozen standings **per `pub_id`** qualify (ties at 3rd place all
  qualify; my call).

### Closing and the Super League

- After `ends_on` the owner sees "Sezóna skončila — uzavrieť ligu?" on the Ligy page. Closing writes
  `league_results` and sets `closed_at`.
- "Vytvoriť Super ligu" (owner, closed LEAGUE only, once per league) creates a `SUPER` league with
  `parent_league_id`. The co-hosts are the league's accepted hosts (status `INVITED`, they accept
  again), the pubs are the owner's pubs (the final venue is picked when ticking the night), and the
  teams are the qualified ones (status `INVITED`).

### Who is invited when

| Event | Invited |
|---|---|
| League created | owner's league pub(s): teams with that pub, or that played a finished night there |
| Co-host accepts | that host's league pubs: same rule |
| Super League created | qualified teams only |

A team is never invited twice to the same league.

## API (all behind `@RequireRole`)

Host (`HOST`):

- `GET /leagues`: my leagues (owner or accepted), host invitations, each with phase and counts.
- `POST /leagues`: `{ name, pubIds, startsOn, endsOn, message, inviteHostIds }`.
- `GET /leagues/:id`: detail with hosts, pubs, teams (status) and standings.
- `PATCH /leagues/:id`: name, dates, message (owner).
- `POST /leagues/:id/hosts/me/accept`: `{ pubIds }`. `POST /leagues/:id/hosts/me/decline`.
- `POST /leagues/:id/close` (owner). `POST /leagues/:id/super-league` (owner).
- `GET /leagues/hosts`: hosts that can be invited (other active hosts, name and their pubs).
- `POST /quizzes/:id/sessions` gains optional `leagueId`.

Captain (`TEAM_CAPTAIN`):

- `GET /registered-teams/:id/leagues`: invitations and leagues of the team, with standings.
- `POST /registered-teams/:id/leagues/:leagueId/join` and `…/decline`.
- `POST /sessions/:id/teams/me/register`: team token + captain session. Links the session team to a
  registered team the captain owns (`{ registeredTeamId }`). `409 REGISTRATION_CLOSED`.

Public: the session state gains `league`. The team summaries already carry `registeredTeamId`.

## Web

- **Host → Ligy** (`/host/leagues`): Moje ligy, Pozvánky (from hosts), Nová liga form (as the
  approved mockup), league detail with standings, close and Super League actions.
- **Launch dialog:** "Táto noc sa počíta do ligy" checkbox and select.
- **Lobby panel / control room:** "neregistrovaný" marker and counter on league nights.
- **Team page:** invitation cards (Pridať sa / Odmietnuť) and a Ligy block with standings.
- **Player phone (lobby):** league banner with the registration offer.
- The `leagues` Pending flag is removed for what is built; the bell stays pending.

## Testing

- API: placing and points (ties, one-off teams ignored), standings tie-breaks, joining by playing
  overriding a decline, the qualification pub snapshot and the top 3 per pub, closing freezes results
  (a later score change does not alter them), Super League raw scoring, invitation rules, launch
  checks, the registration window closing at the first question, role and ownership checks.
- Web: behaviour tests for the Ligy page, the launch tick, the team invitation card and the player
  registration banner.

## Smaller calls (mine, settled while reviewing this document)

- **Subscriptions:** a host with an expired subscription can still propose, accept and close
  leagues. Only launching a night is blocked, as today.
- **Deleted registered teams** leave the league (`league_teams` cascades). `league_results` keeps a
  `team_name` snapshot so a closed table still reads correctly.
- **Registration from the phone** returns the player to the same game screen after sign-up. If they
  abandon it, they are simply an unregistered team.

## Left to the builder

- Exact component layout within the existing Stitch styling.
- Whether standings are computed in SQL or in the service (the service is fine at today's scale).
- Copy beyond the strings quoted here (Slovak first, English alongside).
