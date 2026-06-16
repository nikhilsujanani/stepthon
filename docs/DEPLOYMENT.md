# Stepathon — Deployment Guide

End-to-end setup: local dev → Supabase → Google OAuth → push → Vercel.

---

## 0. Prerequisites

- Node 18+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)
- A Supabase account (free tier) and a Google account
- A Vercel account (free tier)

---

## 1. Local setup

```bash
git clone <your-repo> stepathon && cd stepathon
npm install
cp .env.example .env
npm run dev    # http://localhost:5173  (will error until .env is filled)
```

---

## 2. Supabase project

1. Create a project at <https://supabase.com/dashboard> → note the **Project URL**
   and **anon public** key (Settings → API). Put them in `.env`:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
2. Apply the schema:
   ```bash
   supabase login
   supabase link --project-ref <ref>
   supabase db push          # runs supabase/migrations/0001..0004
   ```
3. **Enable Realtime** on `daily_steps`, `activity_feed`, `notifications`
   (Dashboard → Database → Replication → `supabase_realtime` publication).
4. Make yourself admin (SQL editor), after first login:
   ```sql
   update public.users set role = 'admin' where email = 'you@company.com';
   ```
5. (Optional) regenerate typed client: `npm run db:types`.

---

## 3. Google OAuth

**Google Cloud Console** (<https://console.cloud.google.com>):
1. Create/select a project → **APIs & Services → OAuth consent screen** → External →
   add your email as a test user (or publish).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Authorized **redirect URI** — use the Supabase callback:
   ```
   https://<ref>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client secret**.

**Supabase** (Dashboard → Authentication → Providers → Google):
- Enable, paste Client ID + Secret, save.
- Authentication → URL Configuration → **Site URL** `https://<your-app>.vercel.app`
  and add `http://localhost:5173` + your Vercel URL to **Redirect URLs**.

> Auth is Google-only: `enable_signup` stays on so first sign-in auto-provisions a row
> in `public.users` via the `handle_new_user` trigger. No email/password is exposed.

---

## 4. Web Push (VAPID) + Edge Functions

```bash
npx web-push generate-vapid-keys      # prints PUBLIC and PRIVATE keys
```

Put the public key in `.env`:
```
VITE_VAPID_PUBLIC_KEY=<public key>
```

Set server secrets and deploy the functions:
```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<public> \
  VAPID_PRIVATE_KEY=<private> \
  VAPID_SUBJECT="mailto:admin@company.com"

supabase functions deploy send-push
supabase functions deploy daily-reminder
```

Schedule the reminder (Dashboard → Edge Functions → `daily-reminder` → Cron, or via
`pg_cron`): `0 18 * * *`. Schedule snapshots for movement arrows:
```sql
select cron.schedule('lb-snapshot','0 * * * *',
  $$ select public.capture_leaderboard_snapshot(id) from public.events where status='active' $$);
```

---

## 5. Environment variables (summary)

| Var | Where | Notes |
|-----|-------|-------|
| `VITE_SUPABASE_URL` | client/Vercel | public |
| `VITE_SUPABASE_ANON_KEY` | client/Vercel | public (RLS protects data) |
| `VITE_VAPID_PUBLIC_KEY` | client/Vercel | public |
| `VITE_MAX_STEPS_PER_DAY` | client/Vercel | default 100000 |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Supabase secrets | **server only** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase functions (auto) | **never** ship to client |

---

## 6. Vercel deploy

1. Import the repo at <https://vercel.com/new>. Framework preset: **Vite**.
   - Build command `npm run build`, output `dist`.
2. Add the `VITE_*` env vars (Project → Settings → Environment Variables).
3. Deploy. Then update Supabase **Site URL / Redirect URLs** and the Google OAuth
   redirect to include the production domain.
4. Verify: open on a phone → install to home screen → sign in with Google → submit
   steps → confirm leaderboard updates live and a confetti burst fires.

> SPA routing: `vite-plugin-pwa`'s `navigateFallback: '/index.html'` plus Vercel's
> default SPA handling serve deep links (`/leaderboard`, `/admin`) correctly. If you
> add custom rewrites, ensure all routes fall back to `/index.html`.

---

## 7. Smoke-test checklist

- [ ] Google sign-in creates a `public.users` row.
- [ ] Admin can create + activate an event (second active event is rejected).
- [ ] User can create/join exactly one team per event.
- [ ] `submit_steps` rejects future dates, out-of-window dates, and > max.
- [ ] Submitting steps updates both leaderboards in real time.
- [ ] Crossing 100k awards the 100K Club badge + activity + notification.
- [ ] Enable notifications → `daily-reminder` delivers a push.
- [ ] App installs and shows cached leaderboard offline.
```
