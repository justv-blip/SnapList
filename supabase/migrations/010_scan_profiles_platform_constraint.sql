-- Migration 010: Expand scan_profiles platform constraint
-- The original constraint only allowed ('ebay', 'tcgplayer', 'generic').
-- The TypeScript ExportPlatform type includes 'whatnot', 'shopify', 'squarespace',
-- so inserts for those platforms were silently rejected at the DB level.

alter table public.scan_profiles
  drop constraint if exists scan_profiles_platform_check;

alter table public.scan_profiles
  add constraint scan_profiles_platform_check
  check (platform in ('ebay', 'tcgplayer', 'generic', 'whatnot', 'shopify', 'squarespace'));
