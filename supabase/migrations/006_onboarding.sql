-- ============================================================
-- Migration 006: Add onboarding flag to profiles
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_onboarded boolean NOT NULL DEFAULT false;

-- Existing users are already "onboarded" — don't show the welcome screen to them
UPDATE public.profiles SET has_onboarded = true WHERE has_onboarded = false;
