# Accounts and roles

| Role | Who | Created by | Can |
|---|---|---|---|
| `SUPER_ADMIN` | Platform owners | Set once by hand in the database | Everything a host can, plus `/host/admin`: invite, deactivate and reactivate hosts; rename and delete registered teams |
| `HOST` | Quiz hosts / pubs we work with | A super admin (invite e-mail) | Quizzes, pubs, quiz nights, control room |
| `TEAM_CAPTAIN` | Teams | Self-registration on the landing page | Their registered team (`/team`), joining quiz nights |

Roles are cumulative: a super admin passes every host check, and any account can captain a team.
A host's own team cannot join that host's own quiz nights (`403 OWN_QUIZ`).

## How it is enforced

- Supabase sign-up stays open because captains register themselves. Every new account becomes
  `TEAM_CAPTAIN` (database trigger); only the API can change a role, and only for a super admin.
- The role lives in `profiles.role` (migration `0013_account_roles.sql`). It is never read from
  Supabase `user_metadata`, which users can edit themselves.
- Every authenticated endpoint declares the role it needs with `@RequireRole(...)`; a test
  (`require-role.spec.ts`) fails when a host endpoint is added without one.
- A deactivated host can still sign in and edit quizzes, but cannot launch a quiz night
  (`403 HOST_DEACTIVATED`). Quiz nights already running finish normally.

## One-time setup

1. Apply `supabase/migrations/0013_account_roles.sql`. It makes every account that already owns a
   quiz or a quiz night a `HOST`; everyone else becomes a `TEAM_CAPTAIN`.
2. Make yourself the first super admin (Supabase SQL editor):

   ```sql
   update profiles set role = 'SUPER_ADMIN' where email = '<your e-mail>';
   ```

3. In Supabase → Authentication → URL Configuration, add `<web app URL>/host` (for local
   development `http://localhost:5199/host`) to the redirect URLs, so invite and password-reset
   links land on the set-password screen.
4. Set `WEB_APP_URL` in `apps/api/.env` to the web app's public URL.

Invites are sent by Supabase's e-mail service. Its built-in sender is rate limited (a few e-mails
per hour); configure custom SMTP in Supabase before inviting many hosts.

## Inviting a host

In `/host/admin`, enter the host's e-mail (and optionally a name). A new address gets an invite
e-mail; the link signs them in and asks them to set a password. An address that already has an
account (for example a captain) is turned into a host straight away, without an e-mail.

## Subscriptions

One price for every host, set by hand for now (no payment provider yet).

| Status | Meaning | Can launch quiz nights |
|---|---|---|
| `TRIAL` | The automatic 14 days a new host gets (invite or promotion of a captain) | yes |
| `ACTIVE` | Paid until a date a super admin set; the date itself still counts | yes |
| `FOREVER` | Never expires: set by a super admin; super admins are always forever | yes |
| `EXPIRED` | The date has passed | no (`403 SUBSCRIPTION_EXPIRED`) |

- Dates are Slovak calendar days: "until 30. 11." means through that evening.
- In `/host/admin` a super admin can, per host: **+1 month** (from today, or from the current end
  date if it is later), set an end date, or switch **forever** on and off. Switching forever off
  falls back to the stored date.
- An expired host keeps signing in, editing quizzes and pubs, and seeing past results; only a new
  quiz night is refused. A quiz night already running always finishes.
- Hosts see their status in the sidebar, and a banner during the last 7 days and once expired.
- Someone who becomes a host again keeps their earlier date instead of getting a new trial.
- Deactivation is separate and stronger: it blocks launching regardless of the subscription.
- Columns: `profiles.subscribed_until`, `subscription_forever`, `subscription_trial`
  (migration `0014_host_subscriptions.sql`).
