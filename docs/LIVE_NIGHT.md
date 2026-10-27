# Running a live quiz night from a laptop

> The app is hosted at **https://quiz.cognision.eu** (see [DEPLOY_VPS.md](DEPLOY_VPS.md)): the
> pub's projector computer only needs a browser. This laptop setup is the fallback.

The laptop runs everything and an ngrok tunnel makes it
reachable for players' phones over the internet (pub Wi-Fi often blocks phones from reaching
other devices on the same network).

## One command

```bash
pnpm live                                   # random ngrok address
pnpm live -- --domain your-name.ngrok-free.app   # your fixed address (recommended)
```

It builds everything, starts the API (or reuses one already running on port 3000), serves the
built web app on port 5199, opens the ngrok tunnel and prints the links:

- **Host:** `https://…/host` — open the host screens through **this** address (not `localhost`),
  so the join QR code and link point to the tunnel.
- **Players:** `https://…/play` (or scan the QR in the control room / on the projector).
- **Projector:** open it from the control room ("Otvoriť projektor").

**Ctrl+C** stops everything.

## Once, before the first night

1. `pnpm install`.
2. ngrok installed and signed in: `ngrok config add-authtoken <token>` (already done on this laptop).
3. Optional but recommended: in the ngrok dashboard (Domains), claim the free static domain and
   use it with `--domain` (or set `NGROK_DOMAIN`), so the address never changes between restarts.
4. `apps/web/.env` contains `VITE_API_URL=/api` (the script checks this): the browser reaches the
   API through the same address as the app, so one tunnel is enough.
5. Stop the dev servers (`pnpm dev`) — the script needs port 5199.

## Before the night (at home)

- `git pull` on `master`.
- Prepare the quiz, the pub (Moje puby) and — if the night counts for one — the league.
- Do a short dry run: `pnpm live`, open the host link on the laptop and the player link on a phone
  using mobile data (not the same Wi-Fi).

## On the night

- Free ngrok: each browser sees "You are about to visit…" once — players tap **Visit Site**.
- Keep the laptop on power and stop it from sleeping; a sleeping laptop ends the night for everyone.
- Question pictures and videos load during the lock-in, so they appear without a gap; sound plays
  from the projector.
- **Presentation clicker:** plug it into the laptop and open the projector from the control room, in
  the same browser. Forward steps the night (prepare → show → stop answers → reveal → next
  question; in the lobby it asks first), back plays or pauses the clip, the blank button calls a
  break, and the slideshow button puts the projector into fullscreen. It works with either window
  focused; ending the quiz stays a click in the control room. Check the clicker's keys once on
  keyboard-tester.com — Page Up/Down, arrows, media keys, B and "." are understood. A press that
  does nothing (after the last question, no clip to play) or fails shows a short notice on the
  projector; "the control room is not open" means the control room is not open in the same browser.
- **Timer:** pause, resume and +10 s next to the countdown (pause also in the bottom bar). Teams can
  keep answering while it is paused.
- **Break:** at the reveal, pick a length (or open-ended) and type a message for the room; the
  projector and phones show the countdown and the message.
- **Disputes:** a team can dispute a wrong answer once from its phone. The Review tab shows a
  counter and the team's note; approving gives the points.

## If something goes wrong

- **Phones cannot load the page:** look at the `[ngrok]` lines in the terminal; restart `pnpm live`
  (with a static domain the address and QR stay the same).
- **Page loads but nothing happens:** look at the `[api]` lines for errors; restart `pnpm live`.
  Teams keep their seats (stored on the phone) and catch up automatically.
- **A phone lost its team:** join again with the same team name — the team is taken back over.
