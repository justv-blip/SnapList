-- ============================================================
-- Migration 012 — Sealed product collection
-- Stores the output of /api/scan-sealed so sealed products
-- appear in the user's collection alongside individual cards.
-- ============================================================

create table if not exists public.sealed_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,

  -- Vision identification output
  product_name      text,
  game              text,
  product_type      text,
  set_name          text,
  language          text,
  edition           text,
  confidence        numeric(4, 3) default 0,
  reasoning         text,

  -- Pricing
  market_price_usd  numeric(10, 2),
  price_source      text,
  price_sample_size integer,

  -- User-set condition
  condition         text not null default 'sealed'
                    check (condition in ('sealed', 'opened', 'box_damage')),

  -- Optional user notes
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_sealed_items_user_id on public.sealed_items(user_id);
create index idx_sealed_items_game    on public.sealed_items(game);
create index idx_sealed_items_created on public.sealed_items(created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.sealed_items enable row level security;

create policy "Users can view own sealed items"
  on public.sealed_items for select using (auth.uid() = user_id);

create policy "Users can create sealed items"
  on public.sealed_items for insert with check (auth.uid() = user_id);

create policy "Users can update own sealed items"
  on public.sealed_items for update using (auth.uid() = user_id);

create policy "Users can delete own sealed items"
  on public.sealed_items for delete using (auth.uid() = user_id);
