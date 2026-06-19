-- =====================================================================
-- Stepathon — 0007_event_access_enforcement.sql
-- SECURITY FIX: enforce event_access for ALL events — no bypass paths.
-- =====================================================================

alter table public.events
  add column if not exists requires_admin_setup boolean not null default false;

-- ---------------------------------------------------------------------
-- Legacy backfill: generate join codes, flag events missing passwords
-- ---------------------------------------------------------------------
update public.events
set join_code = 'EVENT-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where join_code is null;

update public.events
set requires_admin_setup = true
where password_hash is null;

-- ---------------------------------------------------------------------
-- Access helpers (server-side enforcement)
-- ---------------------------------------------------------------------
create or replace function public.event_access_configured(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select join_code is not null
         and password_hash is not null
         and not requires_admin_setup
      from public.events
      where id = p_event_id
    ),
    false
  );
$$;

create or replace function public.user_has_event_access(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select exists (
        select 1
        from public.event_access ea
        where ea.event_id = p_event_id
          and ea.user_id = p_user_id
      )
    ),
    false
  );
$$;

create or replace function public.can_participate_in_event(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or (
      public.event_access_configured(p_event_id)
      and public.user_has_event_access(p_event_id, p_user_id)
    );
$$;

-- Backward-compatible name; true only when verification can succeed.
create or replace function public.event_requires_access(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.event_access_configured(p_event_id);
$$;

create or replace function public.get_event_participation_status(p_event_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_requires_setup boolean;
begin
  if v_uid is null then
    return json_build_object(
      'allowed', false,
      'reason', 'verification_required',
      'message', 'Event access verification required.'
    );
  end if;

  if public.is_admin() then
    return json_build_object('allowed', true, 'reason', 'ok', 'message', null);
  end if;

  select requires_admin_setup into v_requires_setup
  from public.events
  where id = p_event_id;

  if coalesce(v_requires_setup, true) or not public.event_access_configured(p_event_id) then
    return json_build_object(
      'allowed', false,
      'reason', 'setup_required',
      'message', 'Event access verification required.'
    );
  end if;

  if not public.user_has_event_access(p_event_id, v_uid) then
    return json_build_object(
      'allowed', false,
      'reason', 'verification_required',
      'message', 'Event access verification required.'
    );
  end if;

  return json_build_object('allowed', true, 'reason', 'ok', 'message', null);
end;
$$;

-- Admin report: events still needing password setup
create or replace view public.v_events_access_setup_report as
select
  e.id,
  e.name,
  e.status,
  e.join_code,
  e.requires_admin_setup,
  (e.password_hash is not null) as has_password,
  e.created_at
from public.events e
where e.requires_admin_setup
   or e.password_hash is null
order by e.created_at desc;

grant select on public.v_events_access_setup_report to authenticated;

-- ---------------------------------------------------------------------
-- Admin password setup clears legacy flag
-- ---------------------------------------------------------------------
create or replace function public.set_event_password(p_event_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if p_password is null or btrim(p_password) = '' then
    update public.events
      set password_hash = null,
          requires_admin_setup = true
      where id = p_event_id;
  else
    update public.events
      set password_hash = crypt(p_password, gen_salt('bf')),
          requires_admin_setup = false
      where id = p_event_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Verify access (only when event fully configured)
-- ---------------------------------------------------------------------
create or replace function public.verify_event_access(p_join_code text, p_password text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_event
  from public.events
  where join_code = btrim(p_join_code)
    and status = 'active';

  if not found then
    raise exception 'INVALID_JOIN_CODE';
  end if;

  if v_event.requires_admin_setup or v_event.password_hash is null then
    raise exception 'PASSWORD_NOT_CONFIGURED';
  end if;

  if v_event.password_hash <> crypt(p_password, v_event.password_hash) then
    raise exception 'INVALID_PASSWORD';
  end if;

  insert into public.event_access (event_id, user_id)
  values (v_event.id, auth.uid())
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- submit_steps — enforce event_access before any write
-- ---------------------------------------------------------------------
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

  if not public.event_access_configured(v_event.id) then
    raise exception 'Event access verification required.' using errcode = 'P0001';
  end if;

  if not public.user_has_event_access(v_event.id, v_uid) then
    raise exception 'Event access verification required.' using errcode = 'P0001';
  end if;

  select * into v_member
  from public.team_members
  where event_id = v_event.id and user_id = v_uid;
  if not found then
    raise exception 'NOT_ON_TEAM' using errcode = 'P0001';
  end if;

  if p_step_date > current_date then
    raise exception 'FUTURE_DATE' using errcode = 'P0001';
  end if;
  if p_step_date < v_event.start_date or p_step_date > v_event.end_date then
    raise exception 'OUT_OF_WINDOW' using errcode = 'P0001';
  end if;

  if p_steps < 0 or p_steps > v_event.max_steps_per_day then
    raise exception 'STEPS_OUT_OF_RANGE: max %', v_event.max_steps_per_day using errcode = 'P0001';
  end if;

  insert into public.daily_steps (user_id, team_id, event_id, step_date, steps)
  values (v_uid, v_member.team_id, v_event.id, p_step_date, p_steps)
  on conflict (user_id, event_id, step_date)
    do update set steps = excluded.steps, updated_at = now()
  returning * into v_row;

  perform public.evaluate_badges(v_uid, v_event.id);
  perform public.log_activity(
    v_event.id, v_member.team_id, v_uid, 'steps_submitted',
    (select full_name from public.users where id = v_uid)
      || ' submitted ' || to_char(p_steps, 'FM999,999,999') || ' steps'
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- catch_next_team — enforce event_access on read
-- ---------------------------------------------------------------------
create or replace function public.catch_next_team(p_team_id uuid)
returns table (next_team_id uuid, next_team_name text, gap bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.teams where id = p_team_id;
  if not found then
    return;
  end if;

  if not public.can_participate_in_event(v_event_id) then
    raise exception 'Event access verification required.' using errcode = 'P0001';
  end if;

  return query
  with me as (select * from public.v_team_leaderboard where team_id = p_team_id),
  target as (
    select tl.* from public.v_team_leaderboard tl, me
    where tl.event_id = me.event_id and tl.rank = me.rank - 1
    limit 1
  )
  select target.team_id, target.team_name::text, (target.total_steps - me.total_steps) + 1
  from target, me;
end;
$$;

grant execute on function public.event_access_configured(uuid) to authenticated;
grant execute on function public.user_has_event_access(uuid, uuid) to authenticated;
grant execute on function public.can_participate_in_event(uuid, uuid) to authenticated;
grant execute on function public.get_event_participation_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS — event-scoped reads/writes require event_access (admin bypass)
-- ---------------------------------------------------------------------
drop policy if exists teams_select_all on public.teams;
create policy teams_select_event_access on public.teams
  for select to authenticated
  using (public.is_admin() or public.can_participate_in_event(event_id));

drop policy if exists team_members_select_all on public.team_members;
create policy team_members_select_event_access on public.team_members
  for select to authenticated
  using (public.is_admin() or public.can_participate_in_event(event_id));

drop policy if exists daily_steps_select_all on public.daily_steps;
create policy daily_steps_select_event_access on public.daily_steps
  for select to authenticated
  using (public.is_admin() or public.can_participate_in_event(event_id));

drop policy if exists activity_feed_select_all on public.activity_feed;
create policy activity_feed_select_event_access on public.activity_feed
  for select to authenticated
  using (public.is_admin() or public.can_participate_in_event(event_id));

drop policy if exists user_badges_select_all on public.user_badges;
create policy user_badges_select_event_access on public.user_badges
  for select to authenticated
  using (public.is_admin() or public.can_participate_in_event(event_id));

drop policy if exists snapshots_select_all on public.leaderboard_snapshots;
create policy snapshots_select_event_access on public.leaderboard_snapshots
  for select to authenticated
  using (public.is_admin() or public.can_participate_in_event(event_id));

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
  for insert to authenticated with check (
    (
      user_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.teams t
        where t.id = team_id and t.captain_id = auth.uid()
      )
    )
    and (
      public.is_admin()
      or (
        public.event_access_configured(event_id)
        and public.user_has_event_access(event_id, auth.uid())
      )
    )
  );

drop policy if exists teams_insert_captain on public.teams;
create policy teams_insert_captain on public.teams
  for insert to authenticated with check (
    captain_id = auth.uid()
    and (
      public.is_admin()
      or (
        public.event_access_configured(event_id)
        and public.user_has_event_access(event_id, auth.uid())
      )
    )
  );
