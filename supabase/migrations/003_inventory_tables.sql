-- ============================================================
-- Migration 003 — Inventory tracking & sync event tables
-- Replaces localStorage-based inventory with server-side persistence.
-- This enables:
--   1. Webhooks to look up inventory items by platform listing ID
--   2. Cross-device inventory access (not tied to a single browser)
--   3. Sync event history that survives server restarts
-- ============================================================

-- ============================================================
-- 1. inventory_items — one row per card in inventory
-- ============================================================

create table if not exists public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  card_id       text not null,           -- maps to ScannedCard.id
  card_name     text not null,
  game          text not null,
  set_name      text,
  image_url     text,
  sku           text,
  total_quantity    integer not null default 1,
  listed_quantity   integer not null default 0,
  available_quantity integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One inventory item per card per user
  unique(user_id, card_id)
);

create index idx_inventory_items_user_id on public.inventory_items(user_id);
create index idx_inventory_items_card_id on public.inventory_items(card_id);

-- ============================================================
-- 2. platform_listings — one row per listing on a platform
-- ============================================================

create table if not exists public.platform_listings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  platform      text not null,           -- 'ebay', 'tcgplayer', 'whatnot', etc.
  listing_id    text not null,           -- platform-specific ID (eBay item ID, etc.)
  listing_url   text,
  status        text not null default 'active'
                check (status in ('draft', 'active', 'sold', 'ended', 'delisted', 'error')),
  list_price    numeric(10, 2) not null default 0,
  quantity      integer not null default 1,
  listed_at     timestamptz not null default now(),
  sold_at       timestamptz,
  last_synced_at timestamptz not null default now(),
  views         integer,
  watchers      integer,
  offers        integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One listing per platform + listing ID per user
  unique(user_id, platform, listing_id)
);

create index idx_platform_listings_user_id on public.platform_listings(user_id);
create index idx_platform_listings_inventory_item on public.platform_listings(inventory_item_id);
-- Critical: fast lookup by platform + listing_id for webhook processing
create index idx_platform_listings_platform_listing on public.platform_listings(platform, listing_id);
create index idx_platform_listings_status on public.platform_listings(status);

-- ============================================================
-- 3. sync_events — audit log for all inventory changes
-- ============================================================

create table if not exists public.sync_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  card_id       text,
  platform      text,
  type          text not null,           -- 'listed', 'sold', 'delisted', 'repriced', etc.
  topic         text,                    -- webhook topic or sync source
  details       text,
  status        text,                    -- 'processed', 'skipped', 'error'
  listing_id    text,
  item_id       text,                    -- eBay item ID (from webhooks)
  previous_value text,
  new_value     text,
  created_at    timestamptz not null default now()
);

create index idx_sync_events_user_id on public.sync_events(user_id);
create index idx_sync_events_created_at on public.sync_events(created_at desc);
create index idx_sync_events_type on public.sync_events(type);
-- Prevent unbounded growth — keep last 90 days via a scheduled job or app-side cleanup

-- ============================================================
-- RLS — users see their own inventory; webhooks use service role
-- ============================================================

alter table public.inventory_items enable row level security;
alter table public.platform_listings enable row level security;
alter table public.sync_events enable row level security;

-- inventory_items: full CRUD for own items
create policy "Users can view own inventory"
  on public.inventory_items for select using (auth.uid() = user_id);
create policy "Users can create inventory items"
  on public.inventory_items for insert with check (auth.uid() = user_id);
create policy "Users can update own inventory"
  on public.inventory_items for update using (auth.uid() = user_id);
create policy "Users can delete own inventory"
  on public.inventory_items for delete using (auth.uid() = user_id);

-- platform_listings: full CRUD for own listings
create policy "Users can view own listings"
  on public.platform_listings for select using (auth.uid() = user_id);
create policy "Users can create listings"
  on public.platform_listings for insert with check (auth.uid() = user_id);
create policy "Users can update own listings"
  on public.platform_listings for update using (auth.uid() = user_id);
create policy "Users can delete own listings"
  on public.platform_listings for delete using (auth.uid() = user_id);

-- sync_events: users can read their own; insert is service-role (webhooks) or user
create policy "Users can view own sync events"
  on public.sync_events for select using (auth.uid() = user_id);
create policy "Users can create sync events"
  on public.sync_events for insert with check (auth.uid() = user_id);

-- Service role bypasses RLS by default, so webhook handlers (using service_role key)
-- can insert sync_events and update listings without additional policies.
