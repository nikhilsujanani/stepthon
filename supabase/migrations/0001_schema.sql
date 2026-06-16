-- =====================================================================
-- Stepathon — 0001_schema.sql
-- Core relational schema: enums, tables, constraints, indexes, triggers.
-- =====================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive team names

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type app_role     as enum ('admin', 'member');
create type team_role    as enum ('captain', 'member');
create type event_status as enum ('draft', 'active', 'closed');
create type activity_type as enum (
  'steps_submitted', 'badge_earned', 'rank_changed', 'streak', 'team_joined', 'milestone'
);
create type notif_type as enum (
  'daily_reminder', 'achievement', 'ranking_change', 'challenge_alert', 'system'
);
create type badge_criteria as enum (
  'single_day_threshold', 'total_threshold', 'streak', 'consistency', 'top_contributor'
);
create type leaderboard_scope as enum ('team', 'individual');

-- ---------------------------------------------------------------------
-- users  (1:1 mirror of auth.users, auto-provisioned via trigger)
-- ---------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  avatar_url  text,
  role        app_role not null default 'member',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table public.events (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text not null default '',
  start_date         date not null,
  end_date           date not null,
  status             event_status not null default 'draft',
  max_steps_per_day  integer not null default 100000 check (max_steps_per_day > 0),
  goal_steps         bigint check (goal_steps is null or goal_steps > 0),
  created_by         uuid not null references public.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint events_date_order check (end_date >= start_date)
);

-- Enforce "only one active event at a time" at the DB level.
create unique index events_one_active_idx
  on public.events ((status))
  where status = 'active';

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        citext not null,
  captain_id  uuid not null references public.users (id),
  created_at  timestamptz not null default now(),
  constraint teams_name_unique_per_event unique (event_id, name)
);
create index teams_event_idx   on public.teams (event_id);
create index teams_captain_idx on public.teams (captain_id);

-- ---------------------------------------------------------------------
-- team_members  (event_id denormalized to enforce one-team-per-event)
-- ---------------------------------------------------------------------
create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  role       team_role not null default 'member',
  joined_at  timestamptz not null default now(),
  constraint team_members_one_per_event unique (event_id, user_id)
);
create index team_members_team_idx on public.team_members (team_id);
create index team_members_user_idx on public.team_members (user_id);

-- ---------------------------------------------------------------------
-- daily_steps  (one row per user per day per event)
-- ---------------------------------------------------------------------
create table public.daily_steps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  step_date   date not null,
  steps       integer not null check (steps >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint daily_steps_one_per_day unique (user_id, event_id, step_date)
);
create index daily_steps_event_date_idx on public.daily_steps (event_id, step_date);
create index daily_steps_team_idx       on public.daily_steps (team_id);
create index daily_steps_user_event_idx on public.daily_steps (user_id, event_id);

-- ---------------------------------------------------------------------
-- badges  (catalog) + user_badges (awards)
-- ---------------------------------------------------------------------
create table public.badges (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text not null,
  icon          text not null default '🏅',
  criteria_type badge_criteria not null,
  threshold     bigint,                       -- steps or days, depending on criteria
  sort_order    integer not null default 0
);

create table public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  badge_id   uuid not null references public.badges (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  constraint user_badges_unique unique (user_id, badge_id, event_id)
);
create index user_badges_user_idx on public.user_badges (user_id, event_id);

-- ---------------------------------------------------------------------
-- activity_feed
-- ---------------------------------------------------------------------
create table public.activity_feed (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  team_id    uuid references public.teams (id) on delete cascade,
  user_id    uuid references public.users (id) on delete set null,
  type       activity_type not null,
  message    text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_feed_event_idx on public.activity_feed (event_id, created_at desc);
create index activity_feed_team_idx  on public.activity_feed (team_id, created_at desc);

-- ---------------------------------------------------------------------
-- notifications  (in-app inbox; push handled separately)
-- ---------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  type       notif_type not null,
  title      text not null,
  body       text not null,
  read       boolean not null default false,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- ---------------------------------------------------------------------
-- push_subscriptions  (Web Push endpoints per device)
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------
-- leaderboard_snapshots  (historical ranks → movement indicators)
-- ---------------------------------------------------------------------
create table public.leaderboard_snapshots (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  scope         leaderboard_scope not null,
  entity_id     uuid not null,               -- team_id or user_id
  rank          integer not null,
  previous_rank integer,
  total_steps   bigint not null default 0,
  captured_at   timestamptz not null default now()
);
create index leaderboard_snapshots_idx
  on public.leaderboard_snapshots (event_id, scope, captured_at desc);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at       before update on public.users       for each row execute function public.set_updated_at();
create trigger events_set_updated_at      before update on public.events      for each row execute function public.set_updated_at();
create trigger daily_steps_set_updated_at before update on public.daily_steps for each row execute function public.set_updated_at();
