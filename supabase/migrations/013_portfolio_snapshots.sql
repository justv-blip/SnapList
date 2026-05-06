-- ============================================================
-- Migration 013 — Portfolio value snapshots
-- Records total collection value over time so users can
-- chart their portfolio growth. Written each time the user
-- loads their collection page (deduped hourly by the API).
-- ============================================================

create table if not exists public.portfolio_snapshots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  total_value_usd  numeric(12, 2) not null default 0,
  card_count       integer not null default 0,
  sealed_count     integer not null default 0,
  recorded_at      timestamptz not null default now()
);

-- Fast time-series queries per user
create index if not exists idx_portfolio_snapshots_user_time
  on public.portfolio_snapshots (user_id, recorded_at desc);

-- RLS
alter table public.portfolio_snapshots enable row level security;

create policy "Users can read own portfolio snapshots"
  on public.portfolio_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own portfolio snapshots"
  on public.portfolio_snapshots for insert
  with check (auth.uid() = user_id);

-- Note: rows older than 365 days can be purged with:
-- delete from portfolio_snapshots where recorded_at < now() - interval '365 days';
