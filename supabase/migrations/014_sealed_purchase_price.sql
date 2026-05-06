-- ============================================================
-- Migration 014 — Sealed item purchase price tracking
-- Adds purchase_price_usd to sealed_items so users can
-- track gain/loss on their sealed product investments.
-- ============================================================

alter table public.sealed_items
  add column if not exists purchase_price_usd numeric(10, 2);
