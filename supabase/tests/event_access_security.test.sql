-- =====================================================================
-- Stepathon — event access security tests
-- Run: supabase db query --linked -f supabase/tests/event_access_security.test.sql
-- =====================================================================

do $$
declare
  v_missing_codes int;
  v_flagged int;
begin
  select count(*) into v_missing_codes from public.events where join_code is null;
  if v_missing_codes > 0 then
    raise exception 'FAIL: % events still missing join_code', v_missing_codes;
  end if;

  select count(*) into v_flagged
  from public.events
  where password_hash is null and not requires_admin_setup;
  if v_flagged > 0 then
    raise exception 'FAIL: % events missing password not flagged requires_admin_setup', v_flagged;
  end if;

  raise notice 'PASS: legacy backfill and flags validated';
end $$;

select id, name, status, join_code, requires_admin_setup, has_password
from public.v_events_access_setup_report;
