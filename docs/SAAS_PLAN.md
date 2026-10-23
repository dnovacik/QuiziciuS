# QuiziciuS as a subscription service — plan

**Goal:** other quiz hosts pay a monthly subscription to run their quiz nights on the QuiziciuS
engine (editor, control room, projector, player phones, pubs, later leagues).

Effort below is for one developer working with Claude, in rough weeks. Treat it as an order of
magnitude, not a quote.

## Where we are

Already in place:

- Every quiz, question, session and answer belongs to one host (`host_id`), and every API call
  checks ownership. Browsers cannot read the database directly (RLS deny-all, all access through
  the NestJS API).
- Pubs are shared records; a host keeps their own pub list. Registered teams are linked to the
  sessions they play — the base for cross-host leagues.
- The whole game loop works: editor, control room, projector, player phones, readiness, untimed
  questions, disputes, paper scores, results export.

Missing for a paid product:

| Gap | Why it matters |
|---|---|
| No roles | Anyone who signs in is effectively a host; captains use the same account type |
| No organizations | A quiz company with several hosts cannot share quizzes, pubs or billing |
| No billing | No way to charge, trial or stop access |
| No plan limits | Realtime traffic and media storage grow with every customer |
| No branding | Hosts usually pay to show *their* brand on the projector and phones |
| Production setup | Hosting, monitoring, backups, rate limits, error tracking, support tooling |
| Legal | Terms, privacy policy, data processing agreement, VAT invoicing |

## Phases

### Phase 0 — Production foundation (1–2 weeks)

- Separate staging and production Supabase projects; migrations applied by CI, not by hand.
- Hosting for the API and web app, custom domain, HTTPS.
- Error tracking and uptime monitoring; database backups with a tested restore.
- Rate limiting on public endpoints (join, by-code lookup, answers).
- A short security review now that strangers' data will sit side by side.

### Phase 1 — Accounts, roles and organizations (2 weeks)

- `organizations` and `organization_members (role: owner | host)`. A solo host is a one-person
  organization, so nothing changes for them.
- Quizzes, sessions and pub lists move from `host_id` to `organization_id` (with `created_by`
  kept). Hosts of one organization share quizzes and pubs.
- Account type at sign-up: **host** (creates an organization) or **team captain** (no host
  features). Invitations for extra hosts by e-mail.
- Pub creation limited to hosts (today any signed-in user could call the API).

### Phase 2 — Billing (1.5–2 weeks)

- Stripe Checkout for sign-up, Stripe Customer Portal for card changes, invoices and cancelling.
- Webhooks keep a `subscriptions` table in sync (status, plan, period end).
- Free trial (e.g. 14 days), then launching a quiz night requires an active subscription. Editing
  quizzes stays available, so a lapsed host never loses work. A grace period for failed payments.
- EU VAT: Stripe Tax or a fixed setup for Slovakia + OSS; invoices with company details.

### Phase 3 — Plans and limits (1 week)

- Plan definitions in one place (quiz nights per month, teams per night, media storage, number of
  hosts).
- Usage counters and enforcement in the API, with upgrade prompts in the host app — never mid-quiz:
  a quiz night that has started always finishes.

### Phase 4 — Branding (1–2 weeks)

- Organization logo, colours and name on the projector, player phones and join page.
- Later: a custom join link per organization (e.g. `quiz.theirpub.sk`).

### Phase 5 — Leagues as a product (3+ weeks, after the league rules are decided)

- Pub leagues and seasons, then super leagues across pubs and hosts (see
  `PUBS_AND_LEAGUES.md`). Cross-host leagues need an owner (an organization or us as platform)
  and rules for who may add pubs and nights to a league.

### Alongside the phases

- **Legal:** terms of service, privacy policy, data processing agreement for hosts (they decide
  what is collected about their players; we process it), cookie notice. Captains' accounts are our
  own data.
- **Support:** an admin view for us (organizations, subscriptions, usage), an audit log of host
  actions, a status page.
- **Landing page:** pricing, sign-up, a demo quiz night.

**Total to a sellable beta (phases 0–3):** roughly 6–7 weeks. With branding: 8–9 weeks.

## Pricing sketch (to validate with real hosts)

| Plan | For | Could include |
|---|---|---|
| Trial | Trying it out | All features, 14 days |
| Pub host | One host, a few pubs | Unlimited quiz nights, up to ~30 teams per night, own branding |
| Company | Quiz companies | Several hosts, shared quiz library, leagues, priority support |

Prices should come from a few conversations with hosts: what they pay today for their tools (or
paper), how many nights per month they run, and whether branding or leagues are the reason to pay.

## Risks

- **Realtime cost.** Every answer and state change is broadcast to all phones and the projector.
  Usage must be measured in phase 0 before limits and prices are set.
- **Peak load.** Many quiz nights start at the same evening hour; load-test a realistic Friday.
- **Data separation.** Moving to organizations touches every query; it needs thorough tests.
- **Market size.** Pub-quiz hosts are a niche; leagues and branding are what could make the
  product hard to replace.

## Decisions needed

1. Organizations from the start, or solo hosts only for the beta?
2. Trial length, and whether a permanently free tier exists (e.g. one quiz night per month).
3. Who owns cross-host leagues: organizations, or the platform?
4. Company / invoicing setup (Slovak s.r.o., VAT registration) before taking payments.
5. Which hosts to talk to first about pricing.
