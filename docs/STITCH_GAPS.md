# Stitch features without backend support

The web UI is ported from the Stitch project "QuiziciuS" (design system *Obsidian Neon Pub*).
Some designed features have no backend yet. Each one is registered in `apps/web/src/ui/Pending.tsx`,
rendered disabled with a **Soon / Čoskoro** badge, and can be hidden everywhere with
`VITE_HIDE_PENDING_FEATURES=true`.

For each item decide: **build** (add backend + remove the `<Pending>` wrapper) or **drop** (delete it from the UI).

| Feature id | Screen | What is missing | Decision |
|---|---|---|---|
| `social-login` | Landing – host card | Google / Microsoft OAuth providers in Supabase + redirect handling | |
| `remember-me` | Landing – host card | Supabase always persists the session; needs a session-storage auth client when unchecked | |
| `table-number` | Landing – team dialog, player join | `teams.table_number` column + join endpoint field; show it to the host | Built (2026-10-24): optional `tableNumber` on join, shown on the host lobby cards (migration `0018`) |
| `qr-scanner` | Player join | In-app camera QR scanner (phones can already scan the projector QR with the camera app) | Built (2026-10-24): on `/play` and the team page's join bar; the browser's `BarcodeDetector` where available, else `jsqr` (loaded on first use) |
| `answer-dispute` | Player reveal | Endpoint for a team to dispute its graded answer + host review queue entry | Built (2026-10-24): `POST /sessions/:id/answers/:answerId/dispute`, once per wrong answer, note shown in the review queue |
| `result-certificate` | Player final results | Generated certificate (PDF/image) for a team's result | Built (2026-10-24): A4 landscape PDF made on the phone — drawn on a canvas with the page font (diacritics), then `jspdf` 4.2.1 (loaded on click) |
| `leagues` | Host sidebar | Leagues section (pub leagues, seasons, super leagues — see PUBS_AND_LEAGUES.md) | Built (2026-10-23): `/host/leagues`, see `docs/superpowers/specs/2026-10-23-leagues-design.md` |
| `host-settings` | Host sidebar | Host account / venue settings page | Built (2026-10-24): `/host/settings` — the host name (`PATCH /me`), e-mail and subscription |
| `notifications` | Host top bar | Notification feed (new teams, disputes) | Built (2026-10-24): computed from live data, nothing stored — answers to review in running nights, league invitations, subscription ending/expired; refreshed every minute |
| `team-ratings` | Host dashboard stat | Teams rate the night after it ends | |
| `scheduled-sessions` | Host dashboard | Sessions planned ahead (date, venue, table capacity, reservations) | Built (2026-10-24), basic data only (date, pub, quiz, note; no capacity or reservations): `/host/schedule`, captains see upcoming nights at their pubs (migration `0022`) |
| `quiz-default-timer` | Quiz settings | Default answer time stored per quiz | Built (2026-10-24): `quizzes.default_time_limit_seconds`, used for new questions (migration `0018`) |
| `numeric-unit` | Quiz editor | `unit` column on numeric questions, shown to players and on the projector | Built (2026-10-24): `questions.unit`, shown next to the phone input, on the projector and with the answer (migration `0018`) |
| `timer-controls` | Control room | Pause / +10 s / host pause — needs a pausable timer in the quiz engine (stopping answers early is built: `POST /sessions/:id/close-answers`) | Built (2026-10-24): `POST /sessions/:id/timer` (pause, resume, extend), migration `0017_live_night_controls.sql` |
| `session-archive` | Control room results | Archiving into league tables, deactivating the code | Built (2026-10-24): a finished night's code is already inactive and leagues already count it; Archive files it away from the sessions list (`POST /sessions/:id/archive`, migration `0021`) |
| `pub-leaderboard` | Team area navigation | Pub / league leaderboard for registered teams | Built (2026-10-24): `GET /registered-teams/pubs/:pubId/leaderboard?period=year\|all`, league place points over the pub's finished nights |
| `team-invite-link` | Team dashboard, add player | Invite link or e-mail for teammates to join a registered team | Built (2026-10-24): invite link (`/join-team/:token`), teammates add their name to the roster without an account; no e-mail sending (migration `0020`) |
| `team-access-pin` | Team dashboard roster | Team PIN so teammates can play as the registered team | Built (2026-10-24): 6-digit PIN, `POST /team-access/sessions/:id/join`; 10 wrong tries per 15 min lock it (migration `0020`) |

## Data the designs show but the API does not provide

These are omitted from the screens (no fake values); adding them needs API work first.

| Data | Stitch screens | Needed |
|---|---|---|
| Host name ("Moderátor Michal Kováč") | player lobby, reveal | host display name in public session state |
| Rounds ("Kolo 2/5") and question total ("Otázka 4 z 10") | player question, reveal | rounds model + question count in session state |
| Question category / ID badge | player question | category per question |
| Team roster, captain role, captain-only submit | player lobby, question, locked | session teams are now linked to registered teams (`teams.registered_team_id`); still needs the roster in session state |
| Who submitted + teams-answered progress ("13 / 14") | player locked | The count is built (`answeredCount` in session state); who submitted is still missing |
| Speed bonus, streaks, jokers, accuracy %, max score | player question, reveal, results | scoring features |
| Host trivia comment after reveal | player reveal | comment field on questions |
| Connection latency / "Supabase Live" health | player question, locked, projector header | realtime connection status from the subscription |
| Venue Wi-Fi name, players at tables ("56 hráčov") | projector lobby | venue settings, player counts per team |
| Teams answered ("12 zo 14 tímov") | projector question | Built (2026-10-24): `answeredCount` in session state |
| Room success rate, fastest team | projector reveal | per-question answer stats after reveal |
| Points gained this round per team | projector leaderboard | score history per question |
| Break countdown, bar promo text | projector pause | Built (2026-10-24): `breakEndsAt` / `breakMessage`, set by the host before the break |
| Host name ("Michal Kováč") | host dashboard, editor header | Built (2026-10-24): set in `/host/settings`, shown in the sidebar and top bar |
| Rounds, quiz description, AI question generator | host dashboard, editor | rounds model, description field |
| Projector connected ("HDMI #1 • 4K"), average ping | control room lobby | projector presence in realtime |
| Answer time per team ("04.1s") and speed bonus | control room question/review | `submitted_at` in the answer summary, scoring rules |
| Per-round score change, streaks, accuracy | control room results | score history per question |

## Added API endpoints (host screens)

- `PATCH /quizzes/:quizId` — rename / change category (editor title, settings dialog)
- `DELETE /quizzes/:quizId` — delete a quiz; refused with `409 QUIZ_IN_PLAY` while a session is not finished
- `GET /host/sessions/:sessionId/answers?questionId=` — every team's graded answers for the host (answer split, answered counter, review table)
- `GET /sessions/:sessionId/disputes` now returns answer summaries (camelCase), like every other answer endpoint

## Left out on purpose

| Stitch element | Why |
|---|---|
| Testimonial card ("U Zlatého leva", Žilina) on the landing page | Fictional quote; needs a real venue testimonial before it can be shown. |
| 6-character "QZ-8492" game PIN | The backend issues 4-character join codes; the UI uses those. |

## Added beyond Stitch

| Element | Why |
|---|---|
| "Sign in" tab in the team dialog | Registered team captains need to sign back in to the team hub. |
| Password recovery mode on the host card | Stitch only shows the "Forgot password?" link. |

## Pubs (built)

Pubs replaced the `venues` placeholder and the team's free-text home pub. Design notes are in
`docs/PUBS_AND_LEAGUES.md`; the schema is migration `0011_pubs.sql`.

- `GET /pubs?q=` — the shared pub list (hosts and captains)
- `GET /host/pubs`, `POST /host/pubs` (add or reuse by name + city), `PUT /host/pubs/:pubId` (link an existing pub), `DELETE /host/pubs/:pubId` (unlink only)
- `POST /quizzes` and `PATCH /quizzes/:quizId` take `pubId` (the quiz's default pub)
- `POST /quizzes/:quizId/sessions` takes `pubId` (omitted → the quiz's pub, `null` → none); `GET /sessions/:id/display` returns `pub`
- Registered teams take `pubIds` (max 5) + `primaryPubId` and return `pubs`
- `POST /registered-teams/:id/sessions/:sessionId/join` — the captain joins as the registered team; the session team is linked and its name is reserved in that session (`409 TEAM_NAME_RESERVED` for one-off teams)
