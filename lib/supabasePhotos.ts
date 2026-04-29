// Supabase Storage helpers for card photos.
// Handles uploading data-URL photos and generating signed download URLs.

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

const BUCKET = "card-photos";

/** Convert a base64 data URL to a Blob for upload. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Get file extension from a data URL mime type. */
function extFromDataUrl(dataUrl: string): string {
  const mime = dataUrl.match(/data:(.*?);/)?.[1] || "image/jpeg";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] || "jpg";
}

/**
 * Upload a single photo data URL to Supabase Storage.
 * Returns the storage path (not a URL — use getSignedUrl to read).
 * Path format: {userId}/{cardId}/{photoId}.{ext}
 */
export async function uploadPhoto(
  userId: string,
  cardId: string,
  photoId: string,
  dataUrl: string
): Promise<string> {
  const supabase = createClient();
  const ext = extFromDataUrl(dataUrl);
  const path = `${userId}/${cardId}/${photoId}.${ext}`;
  const blob = dataUrlToBlob(dataUrl);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      upsert: true, // overwrite if re-saving
    });

  if (error) throw error;
  return path;
}

/**
 * Get a signed URL for a stored photo (valid for 1 hour).
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600); // 1 hour

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Get signed URLs for multiple storage paths in one call.
 * Returns a map of storagePath → signedUrl.
 */
export async function getSignedUrls(
  paths: string[]
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600);

  if (error) {
    logger.error("Failed to generate signed URLs", { error: error.message, bucket: BUCKET, count: paths.length });
    return new Map(); // Graceful fallback — photos won't load but app won't crash
  }

  const map = new Map<string, string>();
  // createSignedUrls returns results in the same order as the input paths
  for (let i = 0; i < (data || []).length; i++) {
    const item = data![i];
    if (item.signedUrl) {
      // Use original path as key (more reliable than item.path)
      map.set(paths[i], item.signedUrl);
    }
  }
  return map;
}

/**
 * Delete photos for a card from storage.
 */
export async function deleteCardPhotos(
  userId: string,
  cardId: string
): Promise<void> {
  const supabase = createClient();
  const prefix = `${userId}/${cardId}/`;

  // List all files in the card's folder
  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list(`${userId}/${cardId}`);

  if (files && files.length > 0) {
    const paths = files.map((f) => `${prefix}${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }
}
