-- =====================================================================
-- Stepathon — 0006_event_access.sql
-- Event join code + password protection and access tracking.
-- =====================================================================

alter table public.events
  add column join_code text,
  add column password_hash text;

create unique index events_join_code_unique_idx
  on public.events (join_code)
  where join_code is not null;

-- ---------------------------------------------------------------------
-- event_access — records users who verified join code + password
-- ---------------------------------------------------------------------
create table public.event_access (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_access_user_idx on public.event_access (user_id);

alter table public.event_access enable row level security;

create policy event_access_select_own on public.event_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.event_requires_access(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select join_code is not null and password_hash is not null
     from public.events where id = p_event_id),
    false
  );
$$;

-- Admin: hash and store event password (plain text never persisted).
create or replace function public.set_event_password(p_event_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if p_password is null or btrim(p_password) = '' then
    update public.events set password_hash = null where id = p_event_id;
  else
    update public.events
      set password_hash = crypt(p_password, gen_salt('bf'))
      where id = p_event_id;
  end if;
end;
$$;

-- User: verify join code + password; grant access to the active event.
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

  if v_event.password_hash is null then
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

grant execute on function public.set_event_password(uuid, text) to authenticated;
grant execute on function public.verify_event_access(text, text) to authenticated;
grant execute on function public.event_requires_access(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Tighten team join/create to require verified access when configured
-- ---------------------------------------------------------------------
drop policy team_members_insert on public.team_members;
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
      or not public.event_requires_access(event_id)
      or exists (
        select 1 from public.event_access ea
        where ea.event_id = team_members.event_id and ea.user_id = auth.uid()
      )
    )
  );

drop policy teams_insert_captain on public.teams;
create policy teams_insert_captain on public.teams
  for insert to authenticated with check (
    captain_id = auth.uid()
    and (
      public.is_admin()
      or not public.event_requires_access(event_id)
      or exists (
        select 1 from public.event_access ea
        where ea.event_id = teams.event_id and ea.user_id = auth.uid()
      )
    )
  );
