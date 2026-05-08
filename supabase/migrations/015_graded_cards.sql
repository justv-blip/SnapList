-- Migration 015 — Graded card fields on the cards table
-- Adds slabbed flag + JSONB grading blob so PSA/BGS/CGC/SGC cert data
-- can be stored alongside regular card data without a separate table.

alter table public.cards
  add column if not exists slabbed  boolean not null default false,
  add column if not exists grading  jsonb;

-- Index for fast graded-card queries
create index if not exists idx_cards_slabbed
  on public.cards (user_id, slabbed)
  where slabbed = true;

-- Also add sku + ebay_listing_id + ebay_offer_id columns that Scanner
-- already tracks client-side but were missing from the DB schema.
alter table public.cards
  add column if not exists sku               text,
  add column if not exists ebay_listing_id   text,
  add column if not exists ebay_offer_id     text;
