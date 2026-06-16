-- =====================================================================
-- Stepathon — 0003_rls.sql
-- Row Level Security. Reads are broad (a competition is public to members);
-- writes are tightly scoped. All step/badge/feed writes flow through
-- SECURITY DEFINER functions, so those tables get NO direct write policy.
-- =====================================================================

alter table public.users                 enable row level security;
alter table public.events                enable row level security;
alter table public.teams                 enable row level security;
alter table public.team_members          enable row level security;
alter table public.daily_steps           enable row level security;
alter table public.badges                enable row level security;
alter table public.user_badges           enable row level security;
alter table public.activity_feed         enable row level security;
alter table public.notifications         enable row level security;
alter table public.push_subscriptions    enable row level security;
alter table public.leaderboard_snapshots enable row level security;

-- ---- users -----------------------------------------------------------
create policy users_select_all on public.users
  for select to authenticated using (true);
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin_all on public.users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- events ----------------------------------------------------------
create policy events_select_all on public.events
  for select to authenticated using (true);
create policy events_admin_write on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- teams -----------------------------------------------------------
create policy teams_select_all on public.teams
  for select to authenticated using (true);
-- A user may create a team for which they are the captain.
create policy teams_insert_captain on public.teams
  for insert to authenticated with check (captain_id = auth.uid());
create policy teams_update_captain on public.teams
  for update to authenticated
  using (captain_id = auth.uid() or public.is_admin())
  with check (captain_id = auth.uid() or public.is_admin());
create policy teams_delete_captain on public.teams
  for delete to authenticated using (captain_id = auth.uid() or public.is_admin());

-- ---- team_members ----------------------------------------------------
create policy team_members_select_all on public.team_members
  for select to authenticated using (true);
-- Join yourself, or be added by the team captain / admin.
create policy team_members_insert on public.team_members
  for insert to authenticated with check (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );
create policy team_members_delete on public.team_members
  for delete to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );

-- ---- daily_steps : read-all, writes ONLY via submit_steps() ----------
create policy daily_steps_select_all on public.daily_steps
  for select to authenticated using (true);

-- ---- badges (catalog) : read-all -------------------------------------
create policy badges_select_all on public.badges
  for select to authenticated using (true);
create policy badges_admin_write on public.badges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- user_badges : read-all, writes via evaluate_badges() ------------
create policy user_badges_select_all on public.user_badges
  for select to authenticated using (true);

-- ---- activity_feed : read-all, writes via log_activity() -------------
create policy activity_feed_select_all on public.activity_feed
  for select to authenticated using (true);

-- ---- notifications : own only ----------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- push_subscriptions : own only -----------------------------------
create policy push_select_own on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy push_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- ---- leaderboard_snapshots : read-all --------------------------------
create policy snapshots_select_all on public.leaderboard_snapshots
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Grants for views (run with security_invoker so RLS on base tables applies)
-- ---------------------------------------------------------------------
alter view public.v_individual_totals      set (security_invoker = on);
alter view public.v_team_totals            set (security_invoker = on);
alter view public.v_team_leaderboard       set (security_invoker = on);
alter view public.v_individual_leaderboard set (security_invoker = on);

grant select on
  public.v_individual_totals, public.v_team_totals,
  public.v_team_leaderboard, public.v_individual_leaderboard
to authenticated;
