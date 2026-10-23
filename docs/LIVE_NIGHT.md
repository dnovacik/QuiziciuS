# Running a live quiz night from a laptop

For test nights before there is a production setup: the laptop runs the API and the web app, and
an ngrok tunnel makes them reachable for players' phones over the internet (pub Wi-Fi often
blocks phones from reaching other devices on the same network).

## Before the night (at home)

1. `git pull` on `master`, `pnpm install`.
2. Check `apps/web/.env` has `VITE_API_URL=/api` — the browser then talks to the API through the
   same address as the app, so one tunnel is enough.
3. Prepare the quiz, the pub (Moje puby) and — if the night counts for one — the league.
4. Optional but recommended: in the ngrok dashboard, claim your free static domain
   (`something.ngrok-free.app`), so the address never changes between restarts.

## On the night

Three terminals, in this order:

```bash
# 1. API
cd apps/api && npx nest start

# 2. Web app, built (much lighter on phones than the dev server), on port 5199
pnpm --filter web live

# 3. Tunnel to the web app (the API goes through it too)
ngrok http 5199                                    # random address
ngrok http 5199 --url=https://<your-static-domain>  # if you claimed one
```

Then:

- **Open the host screens through the ngrok address** (`https://…ngrok-free.app/host`), not
  `localhost`. The join QR code and link use the address the host page is open on.
- Open the projector from the control room (Otvoriť projektor) on the same address.
- The free ngrok plan shows a one-time "You are about to visit…" page in each browser. Players
  tap **Visit Site** once; the app's own API calls skip it.
- Keep the laptop on power and stop it from sleeping; a sleeping laptop ends the night for everyone.

## If something goes wrong

- **Phones cannot load the page:** check the ngrok terminal shows requests; restart ngrok (the
  address changes unless you use the static domain — show the new QR from the control room).
- **Page loads but nothing happens:** the API terminal shows errors; restart it. Teams keep their
  seats (stored on the phone) and rejoin automatically.
- **A phone lost its team:** join again with the same team name — the team is taken back over.

## After the night

Stop ngrok first, then the web app and the API.
