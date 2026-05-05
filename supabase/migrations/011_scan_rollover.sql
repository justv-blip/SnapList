-- Migration 011: Scan rollover — unused scans carry forward each month
--
-- Adds rollover_scans to profiles and a PostgreSQL function that the monthly
-- cron job calls to calculate and persist each paid user's rollover balance.

-- ── Column ────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists rollover_scans integer not null default 0;

-- ── Monthly rollover calculation function ─────────────────────────────────────
-- Called by the /api/cron/reset-scans route on the 1st of every month.
-- For each paid user:
--   1. Look at the previous billing period's scan_usage row.
--   2. Calculate unused scans = max(0, tier_limit - scans_used).
--   3. Cap at the tier's rollover cap.
--   4. Store in profiles.rollover_scans (replaces the previous value).
create or replace function public.calculate_monthly_rollover()
returns void
language plpgsql
security definer
as $$
declare
  v_user           record;
  v_tier           text;
  v_limit          integer;
  v_rollover_cap   integer;
  v_used           integer;
  v_unused         integer;
  v_new_rollover   integer;
  v_prev_start     timestamptz;
begin
  -- Previous month's period_start (first day of last month, midnight UTC)
  v_prev_start := date_trunc('month', now() - interval '1 month');

  for v_user in
    select id, subscription_tier
    from   public.profiles
    where  subscription_tier not in ('free', 'enterprise')
  loop
    v_tier := v_user.subscription_tier;

    -- Tier limits (must match lib/tierLimits.ts TIER_LIMITS)
    v_limit := case v_tier
      when 'starter'  then 500
      when 'pro'      then 2000
      when 'business' then 8000
      else 500
    end;

    -- Rollover caps (must match lib/tierLimits.ts ROLLOVER_CAPS)
    v_rollover_cap := case v_tier
      when 'starter'  then 500
      when 'pro'      then 1000
      when 'business' then 2000
      else 0
    end;

    -- How many scans did this user consume last month?
    select coalesce(scan_count, 0)
    into   v_used
    from   public.scan_usage
    where  user_id      = v_user.id
      and  period_start = v_prev_start;

    -- Unused = what was not consumed (floor at 0)
    v_unused := greatest(0, v_limit - v_used);

    -- Cap at the tier's rollover limit
    v_new_rollover := least(v_unused, v_rollover_cap);

    -- Persist — replaces last month's rollover with this month's
    update public.profiles
    set    rollover_scans = v_new_rollover,
           updated_at     = now()
    where  id = v_user.id;

  end loop;
end;
$$;

-- Grant execute to service role only (called by cron via service key)
revoke execute on function public.calculate_monthly_rollover() from public;
grant  execute on function public.calculate_monthly_rollover() to service_role;
