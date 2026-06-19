-- Restore single-event RPCs and password-protected access (pre multi-event rollback).

-- One active event at a time (re-create if dropped by 0009)
create unique index if not exists events_one_active_idx
  on public.events (status)
  where (status = 'active');

-- ---------------------------------------------------------------------
-- event_access_configured — join code + password required
-- ---------------------------------------------------------------------
create or replace function public.event_access_configured(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

-- ---------------------------------------------------------------------
-- get_event_participation_status — restore 0007 behavior
-- ---------------------------------------------------------------------
create or replace function public.get_event_participation_status(p_event_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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

-- ---------------------------------------------------------------------
-- verify_event_access — join code + password
-- ---------------------------------------------------------------------
drop function if exists public.verify_event_access(text, uuid);
drop function if exists public.verify_event_access(text, text, uuid);

create or replace function public.verify_event_access(p_join_code text, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.verify_event_access(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- submit_steps — single active event (no p_event_id)
-- ---------------------------------------------------------------------
drop function if exists public.submit_steps(uuid, date, integer, text);
drop function if exists public.submit_steps(uuid, date, integer);

create or replace function public.submit_steps(p_step_date date, p_steps integer)
returns public.daily_steps
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.submit_steps(date, integer) to authenticated;

drop function if exists public.get_event_public_stats(uuid);
