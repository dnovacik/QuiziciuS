# Google sign-in

Hosts and team captains can sign in with Google. The button is hidden until the Google provider
is set up and the web app is built with `VITE_GOOGLE_AUTH=true`.

## How accounts work with Google

- A Google sign-in with an e-mail that already has an account signs into that account (Supabase
  links identities with the same verified e-mail). An invited host can sign in with Google if the
  invite went to their Google e-mail.
- A Google sign-in with a new e-mail creates a **team captain** account, like any sign-up. Hosts are
  still only made by a super admin's invite.

## Set it up (about 15 minutes)

1. **Google Cloud Console** (console.cloud.google.com), with any Google account:
   1. Create a project, e.g. "QuiziciuS".
   2. *APIs & Services → OAuth consent screen*: User type **External**, app name **QuiziciuS**,
      support e-mail and developer e-mail; scopes: leave the defaults (e-mail, profile, openid).
      Publish the app (otherwise only listed test users can sign in).
   3. *APIs & Services → Credentials → Create credentials → OAuth client ID*:
      - Application type: **Web application**
      - Authorized JavaScript origins: the site's address, e.g. `https://my-pub.ngrok-free.app`
        (and `http://localhost:5173` for local work)
      - Authorized redirect URIs: **`https://<project-ref>.supabase.co/auth/v1/callback`**
        (the Supabase project URL from `apps/web/.env`, plus `/auth/v1/callback`)
   4. Copy the **Client ID** and **Client secret**.
2. **Supabase dashboard** → *Authentication → Sign In / Providers → Google*: enable it and paste the
   Client ID and Client secret. Save.
3. **Supabase dashboard** → *Authentication → URL Configuration*:
   - Site URL: the site's address (e.g. `https://my-pub.ngrok-free.app`).
   - Redirect URLs: add `https://my-pub.ngrok-free.app/**` (and `http://localhost:5173/**`).
     Without this, Google sends people back to the Site URL instead of the page they started on
     (e.g. the phone remote).
4. **`apps/web/.env`**: set `VITE_GOOGLE_AUTH=true` and restart `pnpm live` (or rebuild).

A static ngrok domain (`pnpm live -- --domain …`) keeps these addresses the same from night to
night; with a random ngrok address every new address has to be added in steps 1.3 and 3.
