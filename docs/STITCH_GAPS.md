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
| `table-number` | Landing – team dialog | `teams.table_number` column + join endpoint field; show it to the host | |

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
