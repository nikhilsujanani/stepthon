# Stepathon — Build & Deployment Runbook

A linear, copy-pasteable procedure to take Stepathon from an empty machine to a
live production PWA. Each phase ends with a **✅ Gate** — do not proceed until it
passes. For the *why* behind any step see [ARCHITECTURE.md](ARCHITECTURE.md);
[DEPLOYMENT.md](DEPLOYMENT.md) is the reference version of the same setup.

> **Time budget:** ~45–60 min first time. **Owner:** one person with admin on the
> Google Cloud project, the Supabase org, and the Vercel account.

---

## Legend

- `🖥️ local` — run in your terminal at the repo root.
- `🟢 supabase` — Supabase dashboard or `supabase` CLI.
- `🔑 google` — Google Cloud Console.
- `▲ vercel` — Vercel dashboard.
- **✅ Gate** — verification checkpoint.

---

## Phase 0 — Accounts & tooling

| Need | Get it |
|------|--------|
| Node 18+ & npm | `node -v` |
| Supabase CLI | `npm i -g supabase` → `supabase -v` |
| Git | `git -v` |
| Supabase account + new org | <https://supabase.com/dashboard> |
| Google account w/ Cloud access | <https://console.cloud.google.com> |
| Vercel account | <https://vercel.com> |

**✅ Gate 0:** `node -v`, `npm -v`, `supabase -v`, `git -v` all print versions.

---

## Phase 1 — Local install & build verification

```bash
# 🖥️ local
git clone <your-repo-url> stepathon
cd stepathon
npm install
cp .env.example .env            # leave values for now; we fill them in Phase 2/4/7
npm run typecheck               # must exit 0
npm run build                   # must print "built in …" and "PWA … files generated"
```

**✅ Gate 1:** `npm run build` succeeds and `dist/sw.js` + `dist/manifest.webmanifest`
exist. (No backend needed yet — this proves the toolchain.)

---

## Phase 2 — Supabase project

1. 🟢 Dashboard → **New project**. Pick a region near your users; save the DB password.
2. 🟢 Settings → **API** → copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. 🖥️ Put both in `.env`:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

**✅ Gate 2:** `.env` has a real URL + anon key. `<ref>` is your project ref (the
subdomain).

---

## Phase 3 — Database schema & verification

```bash
# 🖥️ local
supabase login
supabase link --project-ref <ref>      # paste DB password when prompted
supabase db push                        # applies migrations 0001 → 0004
```

Verify in 🟢 **SQL Editor**:

```sql
-- 11 tables present?
select count(*) from information_schema.tables
where table_schema='public' and table_type='BASE TABLE';   -- expect 11

-- badges seeded?
select code from public.badges order by sort_order;          -- expect 9 rows

-- RLS on everywhere?
select tablename from pg_tables
where schemaname='public' and rowsecurity = false;           -- expect 0 rows

-- the validation RPC exists?
select proname from pg_proc where proname='submit_steps';    -- expect 1 row
```

**✅ Gate 3:** 11 tables, 9 badges, 0 tables without RLS, `submit_steps` present.

---

## Phase 4 — Google OAuth

1. 🔑 **APIs & Services → OAuth consent screen** → *External* → add your email as a
   test user (or Publish to allow your whole org).
2. 🔑 **Credentials → Create credentials → OAuth client ID → Web application**.
3. 🔑 Authorized **redirect URI** (exactly — no trailing slash):
   ```
   https://<ref>.supabase.co/auth/v1/callback
   ```
4. 🔑 Copy **Client ID** + **Client secret**.
5. 🟢 **Authentication → Providers → Google** → enable, paste ID + secret, **Save**.

**✅ Gate 4:** Google provider shows *Enabled* in Supabase.

---

## Phase 5 — Auth URLs

🟢 **Authentication → URL Configuration**:
- **Site URL:** `http://localhost:5173` (swap to the Vercel URL after Phase 9).
- **Redirect URLs:** add both `http://localhost:5173` and (later) `https://<app>.vercel.app`.

**✅ Gate 5:** both URLs listed.

---

## Phase 6 — Realtime & first admin

1. 🟢 **Database → Replication → `supabase_realtime`** → enable for:
   `daily_steps`, `activity_feed`, `notifications`.
2. 🖥️ `npm run dev` → open <http://localhost:5173> → **Sign in with Google** once
   (this provisions your `public.users` row via the `handle_new_user` trigger).
3. 🟢 SQL Editor — promote yourself to admin:
   ```sql
   update public.users set role='admin' where email='you@company.com';
   select email, role from public.users;     -- confirm role='admin'
   ```

**✅ Gate 6:** you can sign in; your row shows `role = admin`; the three tables are in
the realtime publication.

---

## Phase 7 — Web Push & Edge Functions (optional but recommended)

```bash
# 🖥️ local — generate VAPID keys
npx web-push generate-vapid-keys
```

Add the **public** key to `.env`:
```
VITE_VAPID_PUBLIC_KEY=<public key>
```

Set server secrets and deploy functions:
```bash
# 🟢 supabase
supabase secrets set \
  VAPID_PUBLIC_KEY=<public> \
  VAPID_PRIVATE_KEY=<private> \
  VAPID_SUBJECT="mailto:admin@company.com"

supabase functions deploy send-push
supabase functions deploy daily-reminder
```

Schedule jobs (🟢 SQL Editor, requires `pg_cron`):
```sql
-- daily reminder at 18:00
select cron.schedule('daily-reminder','0 18 * * *',
  $$ select net.http_post(
       url := 'https://<ref>.functions.supabase.co/daily-reminder',
       headers := '{"Authorization":"Bearer <service-role-key>"}'::jsonb) $$);

-- hourly leaderboard snapshot → movement arrows ⬆⬇➡
select cron.schedule('lb-snapshot','0 * * * *',
  $$ select public.capture_leaderboard_snapshot(id)
     from public.events where status='active' $$);
```

**✅ Gate 7:** `supabase functions list` shows both functions deployed;
`select * from cron.job;` shows both schedules.

> Skipping push? You can — the app works without it. Just leave
> `VITE_VAPID_PUBLIC_KEY` blank and the "Enable notifications" button no-ops.

---

## Phase 8 — Local end-to-end smoke test

With `npm run dev` running and signed in as admin:

1. Create an event via SQL (admin UI for event creation is a fast follow; the RPC
   path is wired):
   ```sql
   insert into public.events (name, start_date, end_date, status, goal_steps, created_by)
   values ('June Stepathon', current_date - 1, current_date + 13, 'active', 2000000,
           (select id from public.users where role='admin' limit 1));
   ```
2. In the app → **Team** tab → **Create** a team.
3. **Update Steps** → enter `12000` for today → expect 🎉 confetti + redirect home.
4. **Leaderboard** → your team + name appear with totals.
5. **Profile** → *First 10K* badge earned; streak = 1; activity history shows the entry.
6. Try an invalid submit (date in the future) → friendly validation error.

**✅ Gate 8:** all six behaviors pass. This proves schema + RLS + RPC + realtime +
gamification end-to-end.

---

## Phase 9 — Vercel deploy

1. ▲ <https://vercel.com/new> → import the repo. Framework preset auto-detects **Vite**
   (build `npm run build`, output `dist`).
2. ▲ **Settings → Environment Variables** — add for *Production* (and Preview):
   ```
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   VITE_VAPID_PUBLIC_KEY        (if using push)
   VITE_MAX_STEPS_PER_DAY=100000
   ```
3. ▲ **Deploy**. Note the production URL `https://<app>.vercel.app`.
4. Wire the prod URL back into auth:
   - 🟢 Auth → URL Configuration → set **Site URL** to the Vercel URL; add it to
     **Redirect URLs**.
   - 🔑 (Only if you serve OAuth from a custom domain — the Supabase callback URL is
     unchanged, so usually nothing to do in Google.)

**✅ Gate 9:** the Vercel URL loads the login screen over HTTPS.

---

## Phase 10 — Production verification

On a **phone**, against the Vercel URL:

- [ ] Sign in with Google succeeds and returns to the app.
- [ ] Submit steps → leaderboard updates live (open a 2nd device to see realtime).
- [ ] Install to home screen (Add to Home Screen) → launches standalone, no browser chrome.
- [ ] Go offline (airplane mode) → leaderboard still renders from cache.
- [ ] (Push) "Enable notifications" → trigger `daily-reminder` manually:
      `supabase functions invoke daily-reminder` → push arrives.

**✅ Gate 10:** all checked. **You are live.**

---

## Phase 11 — Demo / seed data (optional)

To populate a demo for a kickoff, run in 🟢 SQL Editor (adjust counts):

```sql
-- N demo users → teams → random steps for the active event.
do $$
declare v_event uuid; v_team uuid; v_user uuid; d date;
begin
  select id into v_event from public.events where status='active' limit 1;
  for t in 1..4 loop
    insert into public.teams(event_id,name,captain_id)
    values (v_event,'Demo Team '||t,(select id from public.users order by random() limit 1))
    returning id into v_team;
    for m in 1..5 loop
      -- assumes you have ≥20 seeded auth users; otherwise create via the app first
      select id into v_user from public.users
        where id not in (select user_id from public.team_members where event_id=v_event)
        limit 1;
      exit when v_user is null;
      insert into public.team_members(team_id,user_id,event_id,role)
      values (v_team,v_user,v_event, case when m=1 then 'captain' else 'member' end);
      for d in (select generate_series(
                  (select start_date from public.events where id=v_event),
                  current_date, '1 day')::date) loop
        insert into public.daily_steps(user_id,team_id,event_id,step_date,steps)
        values (v_user,v_team,v_event,d, 4000+floor(random()*11000))
        on conflict do nothing;
      end loop;
    end loop;
  end loop;
end $$;
```

> Real auth users must exist first (Google sign-in). For a pure dataset demo, create
> them via `supabase auth admin create-user` or the dashboard, then run the block.

---

## Ongoing operations

**Start a new event** (only one `active` at a time — DB enforces it):
```sql
update public.events set status='closed' where status='active';   -- close current
insert into public.events(name,start_date,end_date,status,goal_steps,created_by)
values ('Next Event', '2026-07-01','2026-07-14','active', 2000000,
        (select id from public.users where role='admin' limit 1));
```

**Close & declare winner:**
```sql
update public.events set status='closed' where id='<event-id>';
select team_name, total_steps, rank from public.v_team_leaderboard
where event_id='<event-id>' order by rank limit 3;     -- 🥇 = winner
```

**Ship a frontend change:** push to the default branch → Vercel auto-builds & deploys.
**Ship a schema change:** add a new `supabase/migrations/000X_*.sql`, then
`supabase db push` (never edit an already-applied migration).

---

## Rollback

| Situation | Action |
|-----------|--------|
| Bad frontend deploy | ▲ Vercel → Deployments → previous build → **Promote to Production** (instant). |
| Bad migration | Write a new compensating migration (`000X_revert_*.sql`) and `supabase db push`. Do **not** hand-edit applied migrations. Restore from a Supabase PITR backup if data was lost. |
| Leaked anon key | Anon key is public by design (RLS protects data). If the **service-role** key leaked: 🟢 Settings → API → **Reset** it, then re-`supabase secrets set` and redeploy functions. |
| OAuth broken after domain change | Re-check the redirect URI in Google + Site/Redirect URLs in Supabase match the live domain exactly. |
| Runaway/incorrect steps | `update public.daily_steps set steps=<correct> where id='<id>';` then `select public.capture_leaderboard_snapshot('<event-id>');` |

---

## Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| App throws "Missing VITE_SUPABASE_URL" | `.env` not set / not rebuilt | Fill `.env`; on Vercel add env vars and redeploy. |
| Login redirects to a blank page / `?error` | Redirect URL mismatch | Add the exact origin to Supabase Redirect URLs; verify Google callback `…/auth/v1/callback`. |
| Signed in but no `public.users` row | Auth trigger missing | Confirm `0002` applied: `select tgname from pg_trigger where tgname='on_auth_user_created';` |
| `submit_steps` → `NOT_ON_TEAM` | User hasn't joined a team this event | Join via the Team tab first. |
| `submit_steps` → `NO_ACTIVE_EVENT` | No event with `status='active'` | Activate one (Ongoing operations). |
| Leaderboard doesn't update live | Realtime not enabled on `daily_steps` | Add it to the `supabase_realtime` publication (Phase 6). |
| Movement arrows always `✨` | No snapshots captured yet | Run/schedule `capture_leaderboard_snapshot` (Phase 7). |
| Push permission granted but nothing arrives | VAPID secret mismatch / dead endpoint | Re-set VAPID secrets; `send-push` auto-prunes 410/404 endpoints. |
| Deep link (`/leaderboard`) 404 on refresh | SPA fallback missing | `navigateFallback:'/index.html'` is set; ensure no conflicting Vercel rewrite. |
| Build warns chunk > 500 kB | Recharts | Already split into the lazy admin chunk; safe to ignore. |

---

## One-page release checklist

```
[ ] Gate 0  tooling installed
[ ] Gate 1  local build green (dist/sw.js exists)
[ ] Gate 2  .env has Supabase URL + anon key
[ ] Gate 3  11 tables · 9 badges · RLS everywhere · submit_steps present
[ ] Gate 4  Google provider enabled
[ ] Gate 5  Site + Redirect URLs set
[ ] Gate 6  can sign in · self = admin · realtime on 3 tables
[ ] Gate 7  edge functions deployed · cron scheduled   (skip if no push)
[ ] Gate 8  local E2E: create event/team, submit, confetti, badge, validation
[ ] Gate 9  Vercel prod URL loads over HTTPS · prod auth URLs set
[ ] Gate 10 phone E2E: login · live update · installable · offline · push
```
