-- =====================================================================
-- Stepathon — 0002_functions_views.sql
-- Auth provisioning, leaderboard views, RPCs, gamification engine.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: current user's global role (used by RLS + guards)
-- ---------------------------------------------------------------------
create or replace function public.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------
-- Auto-provision public.users on first Google sign-in
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email      = excluded.email,
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
        full_name  = case when public.users.full_name = '' then excluded.full_name else public.users.full_name end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- LEADERBOARD VIEWS
-- =====================================================================

-- Per-user totals within an event (only counts in-window days).
create or replace view public.v_individual_totals as
select
  ds.event_id,
  ds.user_id,
  ds.team_id,
  u.full_name,
  u.avatar_url,
  sum(ds.steps)::bigint as total_steps,
  count(*)::int         as days_logged,
  max(ds.steps)::int    as best_day
from public.daily_steps ds
join public.events e on e.id = ds.event_id
join public.users  u on u.id = ds.user_id
where ds.step_date between e.start_date and e.end_date
group by ds.event_id, ds.user_id, ds.team_id, u.full_name, u.avatar_url;

-- Per-team totals within an event.
create or replace view public.v_team_totals as
select
  t.event_id,
  t.id            as team_id,
  t.name          as team_name,
  t.captain_id,
  coalesce(sum(ds.steps), 0)::bigint            as total_steps,
  count(distinct ds.user_id)::int               as active_members,
  (select count(*) from public.team_members tm where tm.team_id = t.id)::int as member_count
from public.teams t
left join public.daily_steps ds
  on ds.team_id = t.id
  and ds.step_date between (select start_date from public.events e where e.id = t.event_id)
                       and (select end_date   from public.events e where e.id = t.event_id)
group by t.event_id, t.id, t.name, t.captain_id;

-- Ranked team leaderboard.
create or replace view public.v_team_leaderboard as
select
  *,
  dense_rank() over (partition by event_id order by total_steps desc) as rank
from public.v_team_totals;

-- Ranked individual leaderboard.
create or replace view public.v_individual_leaderboard as
select
  vit.*,
  t.name as team_name,
  dense_rank() over (partition by vit.event_id order by vit.total_steps desc) as rank
from public.v_individual_totals vit
join public.teams t on t.id = vit.team_id;

-- =====================================================================
-- STEP SUBMISSION RPC  (all validation server-side)
-- =====================================================================
create or replace function public.submit_steps(p_step_date date, p_steps integer)
returns public.daily_steps
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_event   public.events;
  v_member  public.team_members;
  v_row     public.daily_steps;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_event from public.events where status = 'active' limit 1;
  if not found then
    raise exception 'NO_ACTIVE_EVENT' using errcode = 'P0001';
  end if;

  -- Membership for the active event.
  select * into v_member
  from public.team_members
  where event_id = v_event.id and user_id = v_uid;
  if not found then
    raise exception 'NOT_ON_TEAM' using errcode = 'P0001';
  end if;

  -- Date window + future guard.
  if p_step_date > current_date then
    raise exception 'FUTURE_DATE' using errcode = 'P0001';
  end if;
  if p_step_date < v_event.start_date or p_step_date > v_event.end_date then
    raise exception 'OUT_OF_WINDOW' using errcode = 'P0001';
  end if;

  -- Bounds.
  if p_steps < 0 or p_steps > v_event.max_steps_per_day then
    raise exception 'STEPS_OUT_OF_RANGE: max %', v_event.max_steps_per_day using errcode = 'P0001';
  end if;

  insert into public.daily_steps (user_id, team_id, event_id, step_date, steps)
  values (v_uid, v_member.team_id, v_event.id, p_step_date, p_steps)
  on conflict (user_id, event_id, step_date)
    do update set steps = excluded.steps, updated_at = now()
  returning * into v_row;

  -- Fire gamification + feed.
  perform public.evaluate_badges(v_uid, v_event.id);
  perform public.log_activity(
    v_event.id, v_member.team_id, v_uid, 'steps_submitted',
    (select full_name from public.users where id = v_uid)
      || ' submitted ' || to_char(p_steps, 'FM999,999,999') || ' steps'
  );

  return v_row;
end;
$$;

-- =====================================================================
-- ACTIVITY FEED HELPER
-- =====================================================================
create or replace function public.log_activity(
  p_event_id uuid, p_team_id uuid, p_user_id uuid,
  p_type activity_type, p_message text, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into public.activity_feed (event_id, team_id, user_id, type, message, metadata)
  values (p_event_id, p_team_id, p_user_id, p_type, p_message, p_metadata);
$$;

-- =====================================================================
-- GAMIFICATION ENGINE — evaluate & award badges for one user/event
-- =====================================================================
create or replace function public.evaluate_badges(p_user_id uuid, p_event_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total       bigint;
  v_best_day    int;
  v_streak      int;
  v_event_days  int;
  v_days_logged int;
  v_badge       public.badges;
  v_team_id     uuid;
  v_rank        int;
begin
  select coalesce(sum(steps),0), coalesce(max(steps),0), count(*)
    into v_total, v_best_day, v_days_logged
  from public.daily_steps
  where user_id = p_user_id and event_id = p_event_id;

  v_streak := public.current_streak(p_user_id, p_event_id);

  select (end_date - start_date) + 1 into v_event_days
  from public.events where id = p_event_id;

  for v_badge in select * from public.badges loop
    -- Skip already-awarded.
    if exists (select 1 from public.user_badges
               where user_id = p_user_id and badge_id = v_badge.id and event_id = p_event_id) then
      continue;
    end if;

    if (v_badge.criteria_type = 'single_day_threshold' and v_best_day  >= v_badge.threshold)
    or (v_badge.criteria_type = 'total_threshold'      and v_total     >= v_badge.threshold)
    or (v_badge.criteria_type = 'streak'               and v_streak    >= v_badge.threshold)
    or (v_badge.criteria_type = 'consistency'          and v_days_logged >= v_event_days and v_event_days > 0)
    then
      insert into public.user_badges (user_id, badge_id, event_id)
      values (p_user_id, v_badge.id, p_event_id)
      on conflict do nothing;

      select team_id into v_team_id from public.team_members
        where user_id = p_user_id and event_id = p_event_id;

      perform public.log_activity(
        p_event_id, v_team_id, p_user_id, 'badge_earned',
        (select full_name from public.users where id = p_user_id)
          || ' earned ' || v_badge.name,
        jsonb_build_object('badge_code', v_badge.code)
      );

      insert into public.notifications (user_id, type, title, body, metadata)
      values (p_user_id, 'achievement', 'Achievement unlocked',
              'You earned the ' || v_badge.name || ' badge.',
              jsonb_build_object('badge_code', v_badge.code));
    end if;
  end loop;

  -- Top Contributor (top 3 within team) — criteria_type 'top_contributor'.
  select tm.team_id into v_team_id from public.team_members tm
    where tm.user_id = p_user_id and tm.event_id = p_event_id;

  select rnk into v_rank from (
    select user_id, dense_rank() over (order by sum(steps) desc) rnk
    from public.daily_steps
    where event_id = p_event_id and team_id = v_team_id
    group by user_id
  ) s where s.user_id = p_user_id;

  if v_rank is not null and v_rank <= 3 then
    select * into v_badge from public.badges where criteria_type = 'top_contributor' limit 1;
    if found and not exists (
      select 1 from public.user_badges
      where user_id = p_user_id and badge_id = v_badge.id and event_id = p_event_id
    ) then
      insert into public.user_badges (user_id, badge_id, event_id)
      values (p_user_id, v_badge.id, p_event_id) on conflict do nothing;
    end if;
  end if;
end;
$$;

-- Consecutive-day streak ending today (or last logged day).
create or replace function public.current_streak(p_user_id uuid, p_event_id uuid)
returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_streak int := 0;
  v_day    date := current_date;
begin
  -- If today not logged, anchor on most recent logged day.
  if not exists (select 1 from public.daily_steps
                 where user_id = p_user_id and event_id = p_event_id and step_date = v_day) then
    select max(step_date) into v_day from public.daily_steps
      where user_id = p_user_id and event_id = p_event_id;
    if v_day is null then return 0; end if;
  end if;

  while exists (select 1 from public.daily_steps
               where user_id = p_user_id and event_id = p_event_id and step_date = v_day) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;
  return v_streak;
end;
$$;

-- =====================================================================
-- "CATCH NEXT TEAM" — steps to overtake the team ranked directly above.
-- =====================================================================
create or replace function public.catch_next_team(p_team_id uuid)
returns table (next_team_id uuid, next_team_name text, gap bigint)
language sql stable security definer set search_path = public as $$
  with me as (select * from public.v_team_leaderboard where team_id = p_team_id),
  target as (
    select tl.* from public.v_team_leaderboard tl, me
    where tl.event_id = me.event_id and tl.rank = me.rank - 1
    limit 1
  )
  select target.team_id, target.team_name::text, (target.total_steps - me.total_steps) + 1
  from target, me;
$$;

-- =====================================================================
-- SNAPSHOT — capture current ranks so movement indicators (⬆⬇➡) work.
-- Run via pg_cron / Edge Function on a schedule (e.g. hourly or nightly).
-- =====================================================================
create or replace function public.capture_leaderboard_snapshot(p_event_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Teams
  insert into public.leaderboard_snapshots (event_id, scope, entity_id, rank, previous_rank, total_steps)
  select tl.event_id, 'team', tl.team_id, tl.rank,
         (select s.rank from public.leaderboard_snapshots s
          where s.event_id = tl.event_id and s.scope = 'team' and s.entity_id = tl.team_id
          order by s.captured_at desc limit 1),
         tl.total_steps
  from public.v_team_leaderboard tl
  where tl.event_id = p_event_id;

  -- Individuals
  insert into public.leaderboard_snapshots (event_id, scope, entity_id, rank, previous_rank, total_steps)
  select il.event_id, 'individual', il.user_id, il.rank,
         (select s.rank from public.leaderboard_snapshots s
          where s.event_id = il.event_id and s.scope = 'individual' and s.entity_id = il.user_id
          order by s.captured_at desc limit 1),
         il.total_steps
  from public.v_individual_leaderboard il
  where il.event_id = p_event_id;
end;
$$;
