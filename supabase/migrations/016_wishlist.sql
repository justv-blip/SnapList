-- Migration 016 — Wishlist / Want List
-- Lets users track cards they're looking for, with optional max price and notes.

create table if not exists public.wishlist_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  game          text not null default 'other',
  set_name      text,
  max_price_usd numeric(10, 2),
  notes         text,
  found         boolean not null default false,
  found_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_wishlist_user
  on public.wishlist_items (user_id, created_at desc);

alter table public.wishlist_items enable row level security;

create policy "Users can read own wishlist"
  on public.wishlist_items for select using (auth.uid() = user_id);

create policy "Users can insert own wishlist"
  on public.wishlist_items for insert with check (auth.uid() = user_id);

create policy "Users can update own wishlist"
  on public.wishlist_items for update using (auth.uid() = user_id);

create policy "Users can delete own wishlist"
  on public.wishlist_items for delete using (auth.uid() = user_id);
