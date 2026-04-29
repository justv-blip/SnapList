-- ============================================================
-- TCG Scanner — Grant enterprise access to all existing users
-- Run this in Supabase SQL Editor to upgrade your test account.
-- Safe to run multiple times (idempotent UPDATE).
-- ============================================================

-- Upgrade all existing users to enterprise tier and clear trial limits.
-- Since this is a single-developer testing environment, this grants
-- full platform access. Remove or scope by email before going to production.
UPDATE public.profiles
SET
  subscription_tier  = 'enterprise',
  trial_scans_used   = 0,
  trial_expires_at   = NULL,
  updated_at         = now()
WHERE subscription_tier != 'enterprise';

-- Confirm the result
SELECT id, email, subscription_tier, trial_scans_used, trial_expires_at
FROM public.profiles;
