-- Migration 018 — Auto-reprice settings on profiles
-- Users can opt-in to a daily automatic eBay repricing run.
-- The cron fires once daily; only listings that deviate beyond the
-- threshold percentage from the current market price are touched.

alter table public.profiles
  add column if not exists auto_reprice_enabled       boolean not null default false,
  add column if not exists auto_reprice_threshold_pct integer not null default 10,
  add column if not exists auto_reprice_last_run_at   timestamptz;

-- Index so the cron can quickly find opted-in users
create index if not exists idx_profiles_auto_reprice
  on public.profiles (auto_reprice_enabled)
  where auto_reprice_enabled = true;
