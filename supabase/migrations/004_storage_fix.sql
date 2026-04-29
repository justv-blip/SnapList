-- ============================================================
-- Migration 004 — Ensure card-photos bucket + storage RLS
-- Safe to run even if 001 already ran. Drops and recreates all
-- storage policies so the full set is always consistent.
-- Adds the missing UPDATE policy required for upsert uploads.
-- ============================================================

-- 1. Ensure the bucket exists (no-op if already present)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-photos',
  'card-photos',
  false,
  10485760,    -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Drop any existing storage policies for this bucket so we can
--    recreate them cleanly (handles partial migrations).
drop policy if exists "Users can upload card photos"    on storage.objects;
drop policy if exists "Users can view own card photos"  on storage.objects;
drop policy if exists "Users can update card photos"    on storage.objects;
drop policy if exists "Users can delete own card photos" on storage.objects;

-- 3. INSERT — authenticated user may upload into their own folder
create policy "Users can upload card photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'card-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. SELECT — authenticated user may read (and generate signed URLs for) their own files
create policy "Users can view own card photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'card-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. UPDATE — needed for upsert: true in uploadPhoto()
create policy "Users can update card photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'card-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. DELETE — authenticated user may remove their own files
create policy "Users can delete own card photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'card-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
