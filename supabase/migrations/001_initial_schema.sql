-- ============================================================
-- TCG Scanner — Initial Database Schema
-- Run this in Supabase SQL Editor after creating your project.
-- ============================================================

-- 1. User profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  -- Subscription tier: 'free', 'starter', 'pro', 'business', 'enterprise'
  subscription_tier text not null default 'free',
  -- Stripe customer ID (set after first checkout)
  stripe_customer_id text unique,
  -- When the current billing period started
  billing_period_start timestamptz,
  -- Trial tracking
  trial_scans_used integer not null default 0,
  trial_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Scan usage tracking (for rate limiting per billing period)
create table public.scan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Number of images scanned in this period
  scan_count integer not null default 0,
  -- Billing period this record covers (month start)
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One record per user per billing period
  unique(user_id, period_start)
);

-- 3. Batches (groups of scanned cards)
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Untitled Batch',
  status text not null default 'pending' check (status in ('pending', 'ready', 'listed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Cards (individual scanned cards within a batch)
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  name text not null,
  set_name text,
  set_code text,
  collector_number text,
  rarity text,
  image_url text,
  market_price_usd numeric(10, 2),
  condition text not null default 'Near Mint',
  quantity integer not null default 1,
  foil boolean not null default false,
  language text not null default 'English',
  notes text,
  identification_source text not null default 'manual',
  identification_confidence numeric(3, 2),
  external_url text,
  listing_title text,
  listing_description text,
  created_at timestamptz not null default now()
);

-- 5. Card photos (multiple photos per card: front, back, extra)
create table public.card_photos (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  role text not null default 'front' check (role in ('front', 'back', 'extra')),
  storage_path text not null, -- Supabase Storage path
  created_at timestamptz not null default now()
);

-- 6. Scan profiles (reusable presets for scanning + listing)
create table public.scan_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'New Profile',
  is_active boolean not null default false,
  -- Scan hints
  game text,
  set_name text,
  set_code text,
  rarity text,
  foil_type text,
  exclude_sets text[], -- array of set codes/names to skip
  default_condition text default 'Near Mint',
  language text default 'English',
  notes text,
  -- Listing format
  title_pattern text,
  description_pattern text,
  platform text default 'ebay' check (platform in ('ebay', 'tcgplayer', 'generic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_batches_user_id on public.batches(user_id);
create index idx_batches_updated_at on public.batches(updated_at desc);
create index idx_cards_batch_id on public.cards(batch_id);
create index idx_cards_user_id on public.cards(user_id);
create index idx_card_photos_card_id on public.card_photos(card_id);
create index idx_scan_profiles_user_id on public.scan_profiles(user_id);
create index idx_scan_usage_user_period on public.scan_usage(user_id, period_start);

-- ============================================================
-- Row-Level Security (RLS) — users can only access their own data
-- ============================================================

alter table public.profiles enable row level security;
alter table public.scan_usage enable row level security;
alter table public.batches enable row level security;
alter table public.cards enable row level security;
alter table public.card_photos enable row level security;
alter table public.scan_profiles enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Scan usage: users can read their own usage
create policy "Users can view own usage"
  on public.scan_usage for select using (auth.uid() = user_id);

-- Batches: full CRUD on own batches
create policy "Users can view own batches"
  on public.batches for select using (auth.uid() = user_id);
create policy "Users can create batches"
  on public.batches for insert with check (auth.uid() = user_id);
create policy "Users can update own batches"
  on public.batches for update using (auth.uid() = user_id);
create policy "Users can delete own batches"
  on public.batches for delete using (auth.uid() = user_id);

-- Cards: full CRUD on own cards
create policy "Users can view own cards"
  on public.cards for select using (auth.uid() = user_id);
create policy "Users can create cards"
  on public.cards for insert with check (auth.uid() = user_id);
create policy "Users can update own cards"
  on public.cards for update using (auth.uid() = user_id);
create policy "Users can delete own cards"
  on public.cards for delete using (auth.uid() = user_id);

-- Card photos: access through card ownership
create policy "Users can view own card photos"
  on public.card_photos for select
  using (exists (select 1 from public.cards where cards.id = card_photos.card_id and cards.user_id = auth.uid()));
create policy "Users can create card photos"
  on public.card_photos for insert
  with check (exists (select 1 from public.cards where cards.id = card_photos.card_id and cards.user_id = auth.uid()));
create policy "Users can delete own card photos"
  on public.card_photos for delete
  using (exists (select 1 from public.cards where cards.id = card_photos.card_id and cards.user_id = auth.uid()));

-- Scan profiles: full CRUD on own profiles
create policy "Users can view own scan profiles"
  on public.scan_profiles for select using (auth.uid() = user_id);
create policy "Users can create scan profiles"
  on public.scan_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own scan profiles"
  on public.scan_profiles for update using (auth.uid() = user_id);
create policy "Users can delete own scan profiles"
  on public.scan_profiles for delete using (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup (trigger)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, trial_expires_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    now() + interval '7 days'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Storage bucket for card photos
-- ============================================================

insert into storage.buckets (id, name, public)
values ('card-photos', 'card-photos', false)
on conflict do nothing;

-- Storage policies: users can upload/read/delete their own photos
create policy "Users can upload card photos"
  on storage.objects for insert
  with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own card photos"
  on storage.objects for select
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own card photos"
  on storage.objects for delete
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = auth.uid()::text);
