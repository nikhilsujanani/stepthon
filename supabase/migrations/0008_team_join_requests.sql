-- =====================================================================
-- Stepathon — 0008_team_join_requests.sql
-- Phase 1: in-app team access requests (captain approve/deny).
-- =====================================================================

create type public.team_join_request_status as enum ('pending', 'approved', 'rejected');

create table public.team_join_requests (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  requester_id  uuid not null references public.users (id) on delete cascade,
  message       text not null default '',
  status        public.team_join_request_status not null default 'pending',
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.users (id)
);

create index team_join_requests_team_idx on public.team_join_requests (team_id, status, created_at desc);
create index team_join_requests_requester_idx on public.team_join_requests (requester_id, event_id);

create unique index team_join_requests_one_pending_idx
  on public.team_join_requests (team_id, requester_id)
  where status = 'pending';

alter table public.team_join_requests enable row level security;

create policy team_join_requests_select on public.team_join_requests
  for select to authenticated using (
    requester_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Request access to join a team (routes in-app notification to captain)
-- ---------------------------------------------------------------------
create or replace function public.request_team_access(
  p_team_id uuid,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team public.teams;
  v_request_id uuid;
  v_requester_name text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if not public.can_participate_in_event(v_team.event_id, v_uid) then
    raise exception 'Event access verification required.';
  end if;

  if exists (
    select 1 from public.team_members
    where event_id = v_team.event_id and user_id = v_uid
  ) then
    raise exception 'ALREADY_ON_TEAM';
  end if;

  if exists (
    select 1 from public.team_join_requests
    where team_id = p_team_id and requester_id = v_uid and status = 'pending'
  ) then
    raise exception 'REQUEST_ALREADY_PENDING';
  end if;

  insert into public.team_join_requests (team_id, event_id, requester_id, message)
  values (p_team_id, v_team.event_id, v_uid, coalesce(btrim(p_message), ''))
  returning id into v_request_id;

  select full_name into v_requester_name from public.users where id = v_uid;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    v_team.captain_id,
    'system',
    'Team join request',
    coalesce(v_requester_name, 'Someone')
      || ' requested to join ' || v_team.name::text || '.',
    jsonb_build_object(
      'kind', 'team_access_request',
      'request_id', v_request_id,
      'team_id', p_team_id,
      'event_id', v_team.event_id,
      'requester_id', v_uid
    )
  );

  return v_request_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Captain (or admin) approves or rejects a pending request
-- ---------------------------------------------------------------------
create or replace function public.resolve_team_access_request(
  p_request_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.team_join_requests;
  v_team public.teams;
  v_requester_name text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_req from public.team_join_requests where id = p_request_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_RESOLVED';
  end if;

  select * into v_team from public.teams where id = v_req.team_id;

  if not public.is_admin() and v_team.captain_id <> v_uid then
    raise exception 'FORBIDDEN';
  end if;

  select full_name into v_requester_name
  from public.users where id = v_req.requester_id;

  if p_approve then
    if exists (
      select 1 from public.team_members
      where event_id = v_req.event_id and user_id = v_req.requester_id
    ) then
      raise exception 'REQUESTER_ALREADY_ON_TEAM';
    end if;

    insert into public.team_members (team_id, user_id, event_id, role)
    values (v_req.team_id, v_req.requester_id, v_req.event_id, 'member');

    update public.team_join_requests
      set status = 'approved',
          resolved_at = now(),
          resolved_by = v_uid
      where id = p_request_id;

    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      v_req.requester_id,
      'system',
      'Request approved',
      'You were added to ' || v_team.name::text || '.',
      jsonb_build_object(
        'kind', 'team_access_resolved',
        'request_id', p_request_id,
        'team_id', v_req.team_id,
        'approved', true
      )
    );
  else
    update public.team_join_requests
      set status = 'rejected',
          resolved_at = now(),
          resolved_by = v_uid
      where id = p_request_id;

    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      v_req.requester_id,
      'system',
      'Request declined',
      'Your request to join ' || v_team.name::text || ' was declined.',
      jsonb_build_object(
        'kind', 'team_access_resolved',
        'request_id', p_request_id,
        'team_id', v_req.team_id,
        'approved', false
      )
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- List pending requests for a team (captain/admin)
-- ---------------------------------------------------------------------
create or replace function public.list_pending_team_requests(p_team_id uuid)
returns table (
  id uuid,
  requester_id uuid,
  full_name text,
  email text,
  message text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team public.teams;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then
    return;
  end if;

  if not public.is_admin() and v_team.captain_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    r.id,
    r.requester_id,
    u.full_name,
    u.email,
    r.message,
    r.created_at
  from public.team_join_requests r
  join public.users u on u.id = r.requester_id
  where r.team_id = p_team_id
    and r.status = 'pending'
  order by r.created_at asc;
end;
$$;

-- ---------------------------------------------------------------------
-- Requester's pending requests for an event
-- ---------------------------------------------------------------------
create or replace function public.my_team_join_requests(p_event_id uuid)
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  status public.team_join_request_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.team_id,
    t.name::text as team_name,
    r.status,
    r.created_at
  from public.team_join_requests r
  join public.teams t on t.id = r.team_id
  where r.event_id = p_event_id
    and r.requester_id = auth.uid()
    and r.status = 'pending'
  order by r.created_at desc;
$$;

grant execute on function public.request_team_access(uuid, text) to authenticated;
grant execute on function public.resolve_team_access_request(uuid, boolean) to authenticated;
grant execute on function public.list_pending_team_requests(uuid) to authenticated;
grant execute on function public.my_team_join_requests(uuid) to authenticated;
