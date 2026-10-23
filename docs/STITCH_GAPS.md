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
| `table-number` | Landing – team dialog, player join | `teams.table_number` column + join endpoint field; show it to the host | |
| `qr-scanner` | Player join | In-app camera QR scanner (phones can already scan the projector QR with the camera app) | |
| `answer-dispute` | Player reveal | Endpoint for a team to dispute its graded answer + host review queue entry | |
| `result-certificate` | Player final results | Generated certificate (PDF/image) for a team's result | |

## Data the designs show but the API does not provide

These are omitted from the screens (no fake values); adding them needs API work first.

| Data | Stitch screens | Needed |
|---|---|---|
| Venue name / city ("U Zlatého leva, Žilina") | player join, lobby | venue on quiz or host profile |
| Host name ("Moderátor Michal Kováč") | player lobby, reveal | host display name in public session state |
| Rounds ("Kolo 2/5") and question total ("Otázka 4 z 10") | player question, reveal | rounds model + question count in session state |
| Question category / ID badge | player question | category per question |
| Team roster, captain role, captain-only submit | player lobby, question, locked | link session teams to registered teams and their players |
| Who submitted + teams-answered progress ("13 / 14") | player locked | per-question answered flags in session state |
| Speed bonus, streaks, jokers, accuracy %, max score | player question, reveal, results | scoring features |
| Host trivia comment after reveal | player reveal | comment field on questions |
| Connection latency / "Supabase Live" health | player question, locked, projector header | realtime connection status from the subscription |
| Venue Wi-Fi name, players at tables ("56 hráčov") | projector lobby | venue settings, player counts per team |
| Teams answered ("12 zo 14 tímov") | projector question | per-question answered count in session state |
| Room success rate, fastest team | projector reveal | per-question answer stats after reveal |
| Points gained this round per team | projector leaderboard | score history per question |
| Break countdown, bar promo text | projector pause | break duration + host message |

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
