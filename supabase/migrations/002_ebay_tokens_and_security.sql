-- ============================================================
-- Migration 002 — eBay tokens table & atomic scan usage
-- Fixes:
--   1. Missing ebay_tokens table (client.ts writes to it, but it didn't exist)
--   2. Race condition in scan usage (select-then-upsert → atomic RPC)
--   3. Failed scans counting against limits (only increment on success)
-- ============================================================

-- ============================================================
-- 1. ebay_tokens — stores OAuth tokens per user
-- ============================================================

create table if not exists public.ebay_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS: tokens are accessed exclusively via service-role (server-side API routes).
-- No user-facing RLS policies — the table is invisible to anon/authenticated roles.
alter table public.ebay_tokens enable row level security;

-- Service role can do everything (Supabase service_role bypasses RLS by default,
-- but we add an explicit policy for clarity and in case RLS enforcement changes).
create policy "Service role full access on ebay_tokens"
  on public.ebay_tokens
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Index for fast lookup by user_id (covered by PK, but explicit for documentation)
-- PK already creates a unique index, so no additional index needed.

-- ============================================================
-- 2. Atomic scan usage increment — replaces select-then-upsert
-- ============================================================

-- For PAID tiers: atomically increment scan_usage in a single statement.
-- Returns the NEW scan_count after increment, or -1 if it would exceed the limit.
create or replace function public.increment_scan_usage(
  p_user_id      uuid,
  p_period_start timestamptz,
  p_period_end   timestamptz,
  p_count        integer,
  p_limit        integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_new     integer;
begin
  -- Upsert with locking: INSERT ... ON CONFLICT UPDATE guarantees atomicity.
  insert into public.scan_usage (user_id, scan_count, period_start, period_end, updated_at)
  values (p_user_id, 0, p_period_start, p_period_end, now())
  on conflict (user_id, period_start) do nothing;

  -- Now lock the row and check + increment atomically
  select scan_count into v_current
  from public.scan_usage
  where user_id = p_user_id and period_start = p_period_start
  for update;

  if v_current + p_count > p_limit then
    -- Would exceed limit — return -1 to signal rejection
    return -1;
  end if;

  v_new := v_current + p_count;

  update public.scan_usage
  set scan_count = v_new, updated_at = now()
  where user_id = p_user_id and period_start = p_period_start;

  return v_new;
end;
$$;

-- For FREE tier: atomically increment trial_scans_used on profiles.
-- Returns the NEW count after increment, or -1 if it would exceed the limit.
create or replace function public.increment_trial_usage(
  p_user_id uuid,
  p_count   integer,
  p_limit   integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_new     integer;
  v_expires timestamptz;
begin
  select trial_scans_used, trial_expires_at into v_current, v_expires
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return -1;
  end if;

  -- Check trial expiry
  if v_expires is not null and v_expires < now() then
    return -2;  -- trial expired
  end if;

  if v_current + p_count > p_limit then
    return -1;  -- would exceed limit
  end if;

  v_new := v_current + p_count;

  update public.profiles
  set trial_scans_used = v_new, updated_at = now()
  where id = p_user_id;

  return v_new;
end;
$$;

-- Grant execute to authenticated role (these are called from API routes via service client)
grant execute on function public.increment_scan_usage to service_role;
grant execute on function public.increment_trial_usage to service_role;
