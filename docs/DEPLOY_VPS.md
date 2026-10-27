# Hosting on the VPS (https://quiz.cognision.eu)

The app runs on the `cognision-vps` server next to cognision.eu, n8n and outbreak:

- **Web app:** static files in `/var/www/quiz.cognision.eu/current`, served by nginx
  (`/etc/nginx/sites-available/quiz.cognision.eu`, HTTPS by certbot, renews on its own).
- **API:** the `quizicius-api` systemd service, as user `quizicius`, from `/opt/quizicius/current`,
  listening on `127.0.0.1:3100` only; nginx forwards `https://quiz.cognision.eu/api/` to it.
- **Secrets:** `/etc/quizicius/api.env` (root only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `TEAM_TOKEN_SECRET`, plus `PORT=3100`, `HOST=127.0.0.1`, `NODE_ENV=production`.
- **Database:** Supabase, as before.

## Deploying

From this repo on `master`, with `apps/web/.env` filled in (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) and SSH access to `cognision-vps`:

```bash
pnpm deploy:vps
```

It builds everything here, uploads it, installs the API's dependencies on the server (pinned to
the versions installed here), switches both `current` links to the new release, restarts the API
and checks that it answers. The three newest releases stay in `/opt/quizicius/releases` and
`/var/www/quiz.cognision.eu/releases`.

Run migrations against Supabase before deploying code that needs them.

## Rollback

```bash
ssh cognision-vps
ls -1t /opt/quizicius/releases                        # pick the previous one, e.g. 20261027-135001
ln -sfn /opt/quizicius/releases/<release> /opt/quizicius/current
ln -sfn /var/www/quiz.cognision.eu/releases/<release> /var/www/quiz.cognision.eu/current
systemctl restart quizicius-api
```

## Looking at it

```bash
ssh cognision-vps
systemctl status quizicius-api
journalctl -u quizicius-api -f        # API logs
```

## Supabase

Password sign-in needs nothing extra. For e-mail links and Google sign-in, add
`https://quiz.cognision.eu/**` to Authentication → URL Configuration → Redirect URLs.
