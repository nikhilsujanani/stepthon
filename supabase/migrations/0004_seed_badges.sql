-- =====================================================================
-- Stepathon — 0004_seed_badges.sql
-- Badge catalog. Idempotent (upsert on code).
-- =====================================================================
insert into public.badges (code, name, description, icon, criteria_type, threshold, sort_order) values
  ('first_10k',     'First 10K',             'First day above 10,000 steps',          '👟', 'single_day_threshold', 10000,  1),
  ('club_50k',      '50K Club',              'Total steps over 50,000',               '🥉', 'total_threshold',      50000,  2),
  ('club_100k',     '100K Club',             'Total steps over 100,000',              '🥈', 'total_threshold',      100000, 3),
  ('club_250k',     '250K Club',             'Total steps over 250,000',              '🥇', 'total_threshold',      250000, 4),
  ('club_500k',     '500K Club',             'Total steps over 500,000',              '🏆', 'total_threshold',      500000, 5),
  ('streak_7',      '7 Day Streak',          'Submitted steps 7 consecutive days',    '🔥', 'streak',               7,      6),
  ('streak_14',     '14 Day Streak',         'Submitted steps 14 consecutive days',   '🔥', 'streak',               14,     7),
  ('consistency',   'Consistency Champion',  'Submitted every day of the event',      '📅', 'consistency',          null,   8),
  ('top_contrib',   'Top Contributor',       'Top 3 contributor in your team',        '⭐', 'top_contributor',      null,   9)
on conflict (code) do update set
  name        = excluded.name,
  description = excluded.description,
  icon        = excluded.icon,
  criteria_type = excluded.criteria_type,
  threshold   = excluded.threshold,
  sort_order  = excluded.sort_order;
