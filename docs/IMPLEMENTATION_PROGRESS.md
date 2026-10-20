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
| 01 — i18n foundation + tracker | MERGED | Homepage defaults to SK, language switch persists EN/SK; tests/build |
| Landing refresh — full design and SK/EN | IN REVIEW — VISUAL + CI | Check hero SVG, CTAs, anchors, translation, responsive layout |
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

## PR 01 — local verification
1. `pnpm install --frozen-lockfile`
2. `pnpm -r build`
3. `pnpm -r --workspace-concurrency=1 run test`
4. `pnpm --filter web dev` and visit `/`.
5. Check Slovak default, select 🇬🇧 English, refresh, then select 🇸🇰 Slovak; check `/host` and `/play` links.
7. Check responsive illustrated hero on mobile and desktop. This is a CSS prototype; a finalized branded image asset can replace it later.
6. Ensure this is only the i18n foundation: existing host, player, and projector screens are not yet translated.

Verification status: authored tests, but no local environment test run by assistant; GitHub CI must complete.

## Landing refresh PR — local checks
- `pnpm -r build` and `pnpm -r --workspace-concurrency=1 run test`
- Open `/` at 375px and desktop widths; check nav, hero, cards, and steps do not overflow.
- Switch flags; all new landing copy should translate to EN and SK.
- Check host links go to `/host` and team link goes to `/play` (legacy flow until team auth PR).
- Artwork is a checked-in static SVG illustration, not a photo; it follows the mock's composition while remaining light and self-hosted.
- No new API/backend functionality required for this screen.

## Gemini landing layout review (PR #2)
- Uploaded Gemini TSX is the layout source of truth; replaced the earlier SVG-led implementation.
- Functional: brand -> `/`, host sign-in -> `/host` (existing Supabase-host auth), play CTA / sample team CTA -> `/play` (legacy join), locale flag buttons, mobile navigation, section scroll links, illustrative question selection.
- Non-functional by design: create-team account (registration/auth planned in next PR), preview quiz submission, dashboard sample 'new event', historical team results (no public team account results yet), legal/policy/support links (no published pages).
- Avoid misleading controls: the above unfinished actions are shown as static preview/coming-soon text, not working buttons.
- Mock counters do not claim actual platform uptake; sample event/team content is illustrative and not loaded from the database.
- No backend endpoint was invented or changed as part of this landing-only PR.
- Local QA: check desktop and mobile layouts, both locales, `/host` / `/play` routing, sample quiz selection, all visible anchor navigation and CI.

## Landing navigation refinement
- Sticky translucent header stays visible while scrolling, with overflow clipping instead of overflow-x hidden so sticky positioning can work.
- Keep only 2 useful section links: quiz preview and audience cards. Removed duplicate/unimplemented Features, How it works, Pubs & leagues, Super-League, and Contact menu items.
- Active section uses purple underline and `aria-current=location`; mobile navigation mirrors the same sections.
- Review at desktop/mobile and verify header sticks and purple underline updates as sections enter view.
