# Phase 1 Design — Core Quiz Engine & Single Quiz Night

Date: 2026-09-16
Status: Approved

## Context

Quizicius is a real-time Pub Quiz PWA platform with three views (`/host`, `/projector`, `/play`), a NestJS backend, and Supabase (Postgres + Realtime Broadcast + Storage). The full product vision (leagues/seasons, hardened anti-cheat, joker/wager mechanics, tie-breaks) is decomposed into four phases. This document specs **Phase 1 only**: a working single quiz night, end to end, for a multi-tenant host base.

## Phase Breakdown (for context)

1. **Phase 1 — Core engine & single quiz night** (this doc). Multi-tenant host auth, full state machine, all three views, MC/free-text/numeric grading, basic anti-cheat signals + dispute queue, paper-mode scoring, PWA installability. Schema includes `leagues` (unused).
2. **Phase 2 — Reliability & anti-cheat hardening.** Reconnection/resync, device-token trust handling, rate limiting, background sync for flaky connections, push notifications.
3. **Phase 3 — Leagues & seasons.** Multi-week aggregation endpoints/UI, season standings, tie-break rules for standings.
4. **Phase 4 — Game-feel extras.** Jokers/power-ups, tie-break rounds, wager rounds, host takeover of a dead team device.

## Key Decisions

- **Tenancy:** Multi-tenant SaaS from day one. Host auth via Supabase Auth (email/password), validated in NestJS via a Guard checking the Supabase JWT.
- **Write path:** All reads/writes go through NestJS REST. Clients never talk to Supabase directly for data. Supabase Realtime Broadcast is used only as a low-latency push channel (NestJS publishes with the service-role key); every client also has `GET /sessions/:id/state` to rehydrate on connect/reconnect, so a missed broadcast is never fatal. This sidesteps RLS complexity for Phase 1 — a deliberate simplification.
- **Schema scope:** `leagues` table included now (unused) so Phase 3 needs only new endpoints/UI, not a migration.
- **Anti-cheat scope:** Basic client-side signals only (Wake Lock, Fullscreen, `visibilitychange`), logged as infractions and surfaced to the host — **no automatic scoring penalty**. False positives (OS notification banners, etc.) are common enough that auto-penalizing would train hosts to ignore the signal.
- **Team identity:** Team/play devices get a lightweight signed token issued by NestJS on join, scoped to `{session_id, team_id}` — not a full Supabase Auth user. A new join for the same team invalidates the previous token ("last device wins") rather than hard-rejecting, to avoid support headaches when a phone dies mid-quiz. Revisit in Phase 2 if this proves too loose.

## Architecture

Monorepo:
- `apps/api` — NestJS
- `apps/web` — single Vite React app, three lazy-loaded route trees (`/host`, `/projector`, `/play`) so `/play`'s bundle stays minimal on flaky devices
- `packages/shared-types` — enums/DTOs shared by both apps, so `quiz_state`/`question_type` can't drift between frontend and backend

`/projector` has no auth — protected only by the obscurity of an unguessable session URL, acceptable for the pub context.

## Data Model

```
profiles         (id → auth.users.id, display_name)
leagues          (id, host_id, name, created_at)
quizzes          (id, host_id, league_id nullable, title, created_at)
questions        (id, quiz_id, type, prompt, options jsonb, accepted_answers text[],
                   correct_numeric numeric, points, time_limit_seconds, order_index)
quiz_sessions    (id, quiz_id, host_id, join_code, status, current_question_id nullable,
                   question_ends_at nullable, created_at, started_at, finished_at)
teams            (id, session_id, name, device_token_hash, joined_at, is_active)
answers          (id, session_id, question_id, team_id, response, is_correct nullable,
                   confidence nullable, needs_review bool, graded_by, graded_at,
                   submitted_at, score_awarded)
infractions      (id, session_id, team_id, type, detected_at, reviewed bool)
```

Enums: `quiz_state`, `question_type` (as originally specified), plus `infraction_type` (`VISIBILITY_HIDDEN`, `FULLSCREEN_EXIT`, `WAKE_LOCK_LOST`).

Unique constraint on `answers(session_id, question_id, team_id)` makes `submitAnswer` idempotent (upsert, not insert). `join_code` is a short, unique-while-active, spoken-aloud-friendly code (e.g. 4 alphanumeric chars), distinct from the session UUID.

## State Machine & Grading (`QuizEngineService`)

Transitions are a validated edge table, not a free setter:

```
LOBBY → LOCK_IN_ROUND → QUESTION_ACTIVE → QUESTION_REVEAL → { LOCK_IN_ROUND | PAUSE_BREAK | FINISHED }
PAUSE_BREAK → LOCK_IN_ROUND
FINISHED reachable as a host override from most states
```

Entering `QUESTION_ACTIVE` computes `question_ends_at` server-side and persists it before broadcasting, so REST rehydration and broadcast always agree.

Grading dispatches by `question_type`:
- `MULTIPLE_CHOICE` — graded immediately on submit (exact match against the correct option).
- `NUMERIC_NEAREST` — graded at `QUESTION_REVEAL` (rank all answers by distance to the correct value; closest wins; ties split points).
- `FREE_TEXT` — input normalized (lowercase, strip punctuation/diacritics) then compared against `accepted_answers[]` via Levenshtein-based similarity. >80% confidence → auto-true; 50–80% → `needs_review = true` (pushed to the host dispute queue); <50% → auto-false.

`resolveDispute(answerId, hostId, decision)` sets `graded_by = 'HOST'`, recalculates the team's score, and broadcasts `SCORE_UPDATE`.

## Anti-Cheat (Phase 1 scope)

`useQuizSecurity` hook:
- Activates Wake Lock + Fullscreen during `LOCK_IN_ROUND` / `QUESTION_ACTIVE`.
- Releases both on `QUESTION_REVEAL` / `PAUSE_BREAK`.
- POSTs an infraction to `/api/infractions/report` on `visibilitychange` → `hidden`.

Infractions are logged and shown as a count/badge in the host's team list and dispute queue. No automatic scoring penalty — host judgment only.

## Views (Phase 1 scope)

- **`/host`** — Supabase Auth login; quiz/question CRUD; session creation + join-code display; state transition controls; live team list with infraction badges; dispute queue (approve/reject `FREE_TEXT` needs-review + infraction review); paper-mode manual score entry grid.
- **`/projector`** — read-only, subscribes to the session via ID in the URL; renders state, countdown ring, scoreboard, reveal animation.
- **`/play`** — join screen (join code + team name → team token); lock-in tap overlay; question renderer per type; anti-cheat active during `LOCK_IN_ROUND` / `QUESTION_ACTIVE`; reveal screen showing correct answer + score delta.

## Error Handling

- Illegal transition attempt → `409` with current state included, so the host UI can resync instead of retrying blindly.
- Late `submitAnswer` → rejected with `422`, but a small grace buffer (~2s past `question_ends_at`) absorbs network latency.
- Invalid/expired team token → `401`, client bounces to the join screen.
- Realtime publish failure → logged, retried once; state is already durably persisted, so REST rehydration is the fallback source of truth, not the broadcast.

## Testing

- Unit tests on `QuizEngineService` for every legal/illegal transition edge and each grading path (including the 50%/80% confidence boundaries).
- One integration test driving a full session lifecycle over REST (create session → transition through all states → submit answers → reveal → score).
- `useQuizSecurity` tested with mocked `navigator.wakeLock` / fullscreen / `visibilitychange` APIs in jsdom.
- No browser E2E in Phase 1 — explicitly deferred until the UI stabilizes.

## Out of Scope (Phase 1)

- Reconnection/resync hardening beyond the REST rehydration fallback (Phase 2)
- Device fingerprinting / trust scoring / auto-penalties (Phase 2)
- Rate limiting on submission endpoints (Phase 2)
- Leagues/seasons UI and aggregation endpoints (Phase 3)
- Jokers, wagers, tie-break rounds, host takeover of a team device (Phase 4)
