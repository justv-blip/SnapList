-- Price history — one row per price observation per user.
-- Populated automatically on every scan or lookup that returns a price.
-- Used by market analysis to compute 7d / 30d trends over time.

create table if not exists public.price_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  card_fingerprint text not null,  -- e.g. "pokemon:charizard ex:surging sparks"
  game             text not null,
  card_name        text not null,
  set_name         text,
  price_usd        numeric(10, 2) not null,
  source           text not null default 'scan', -- 'scan' | 'lookup' | 'market-analysis'
  recorded_at      timestamptz not null default now()
);

-- Fast time-series queries per card
create index if not exists idx_price_history_fingerprint_time
  on public.price_history (card_fingerprint, recorded_at desc);

-- Fast user-scoped queries
create index if not exists idx_price_history_user_time
  on public.price_history (user_id, recorded_at desc);

-- RLS
alter table public.price_history enable row level security;

create policy "Users can read own price history"
  on public.price_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own price history"
  on public.price_history for insert
  with check (auth.uid() = user_id);

-- Note: rows older than 90 days can be purged with:
-- delete from price_history where recorded_at < now() - interval '90 days';
-- Consider a scheduled Supabase Edge Function or pg_cron job for this.
