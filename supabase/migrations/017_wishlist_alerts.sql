-- Migration 017 — Price alerts for wishlist items
-- Users can set a target price per wishlist item; a daily cron checks
-- eBay sold comps and sends a Resend email when the market hits the target.

alter table public.wishlist_items
  add column if not exists alert_price_usd  numeric(10, 2),
  add column if not exists alert_enabled    boolean not null default false,
  add column if not exists alert_sent_at    timestamptz,
  add column if not exists last_checked_at  timestamptz;

-- Fast lookup of active alerts (for the cron job running as service role)
create index if not exists idx_wishlist_alerts_active
  on public.wishlist_items (alert_sent_at)
  where alert_enabled = true and found = false and alert_price_usd is not null;
