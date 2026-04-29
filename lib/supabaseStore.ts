// Supabase-backed persistence layer for batches and cards.
// Replaces the localStorage store with real database persistence.
// Every function is async — callers must await.

import type { ScannedCard, CardPhoto, BatchConfig } from "./types";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, getSignedUrls } from "./supabasePhotos";

export type BatchStatus = "pending" | "ready" | "listed";

export interface Batch {
  id: string;
  name: string;
  cards: ScannedCard[];
  status: BatchStatus;
  config?: BatchConfig; // Batch-level settings (game, condition, pricing, etc.)
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface BatchSummary {
  totalCards: number;
  totalPhotos: number;
  totalValue: number;
  pendingCount: number;
  readyCount: number;
  listedCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map a database card row + its photos into a ScannedCard.
 *  signedUrlMap is optional — if provided, resolves storage paths to signed URLs.
 */
function dbCardToScanned(
  row: Record<string, unknown>,
  photos: Record<string, unknown>[],
  signedUrlMap?: Map<string, string>
): ScannedCard {
  return {
    id: row.id as string,
    game: row.game as ScannedCard["game"],
    name: row.name as string,
    setName: (row.set_name as string) || undefined,
    setCode: (row.set_code as string) || undefined,
    collectorNumber: (row.collector_number as string) || undefined,
    rarity: (row.rarity as string) || undefined,
    imageUrl: (row.image_url as string) || undefined,
    photos: photos.map((p) => {
      const storagePath = p.storage_path as string;
      return {
        id: p.id as string,
        role: p.role as CardPhoto["role"],
        // Only use a resolved signed URL. A raw storage path is not a valid
        // URL — falling back to it causes broken images. An empty string here
        // lets GridCard/ListCard fall through to card.imageUrl instead.
        dataUrl: signedUrlMap?.get(storagePath) ?? "",
      };
    }),
    marketPriceUsd: row.market_price_usd != null ? Number(row.market_price_usd) : undefined,
    condition: (row.condition as ScannedCard["condition"]) || "Near Mint",
    quantity: Number(row.quantity) || 1,
    foil: Boolean(row.foil),
    language: (row.language as string) || "English",
    notes: (row.notes as string) || undefined,
    identificationSource: (row.identification_source as ScannedCard["identificationSource"]) || "manual",
    identificationConfidence:
      row.identification_confidence != null ? Number(row.identification_confidence) : undefined,
    externalUrl: (row.external_url as string) || undefined,
    listingTitle: (row.listing_title as string) || undefined,
    listingDescription: (row.listing_description as string) || undefined,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

/** Convert a ScannedCard into a database row shape (snake_case). */
function scannedToDbCard(
  card: ScannedCard,
  batchId: string,
  userId: string
): Record<string, unknown> {
  return {
    id: card.id,
    batch_id: batchId,
    user_id: userId,
    game: card.game,
    name: card.name,
    set_name: card.setName || null,
    set_code: card.setCode || null,
    collector_number: card.collectorNumber || null,
    rarity: card.rarity || null,
    image_url: card.imageUrl || null,
    market_price_usd: card.marketPriceUsd ?? null,
    condition: card.condition,
    quantity: card.quantity,
    foil: card.foil,
    language: card.language,
    notes: card.notes || null,
    identification_source: card.identificationSource,
    identification_confidence: card.identificationConfidence ?? null,
    external_url: card.externalUrl || null,
    listing_title: card.listingTitle || null,
    listing_description: card.listingDescription || null,
  };
}

// ---------------------------------------------------------------------------
// Get current user id
// ---------------------------------------------------------------------------

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ---------------------------------------------------------------------------
// Public API — Batches
// ---------------------------------------------------------------------------

export async function getAllBatches(): Promise<Batch[]> {
  const supabase = createClient();
  const userId = await getUserId();

  const { data: rows, error } = await supabase
    .from("batches")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  // Fetch all cards for these batches in one query
  const batchIds = rows.map((r) => r.id);
  const { data: cardRows } = await supabase
    .from("cards")
    .select("*")
    .in("batch_id", batchIds);

  // Fetch all photos for these cards
  const cardIds = (cardRows || []).map((c) => c.id);
  let photoRows: Record<string, unknown>[] = [];
  if (cardIds.length > 0) {
    const { data } = await supabase
      .from("card_photos")
      .select("*")
      .in("card_id", cardIds);
    photoRows = (data || []) as Record<string, unknown>[];
  }

  // Group photos by card_id
  const photosByCard = new Map<string, Record<string, unknown>[]>();
  for (const p of photoRows) {
    const cid = p.card_id as string;
    if (!photosByCard.has(cid)) photosByCard.set(cid, []);
    photosByCard.get(cid)!.push(p);
  }

  // Resolve signed URLs for all photos in one batch call
  const allStoragePaths = photoRows
    .map((p) => p.storage_path as string)
    .filter(Boolean);
  const signedUrlMap = await getSignedUrls(allStoragePaths);

  // Group cards by batch_id
  const cardsByBatch = new Map<string, ScannedCard[]>();
  for (const c of cardRows || []) {
    const bid = c.batch_id as string;
    if (!cardsByBatch.has(bid)) cardsByBatch.set(bid, []);
    cardsByBatch.get(bid)!.push(
      dbCardToScanned(c as Record<string, unknown>, photosByCard.get(c.id) || [], signedUrlMap)
    );
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cards: cardsByBatch.get(r.id) || [],
    status: r.status as BatchStatus,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  }));
}

export async function getBatch(id: string): Promise<Batch | undefined> {
  const supabase = createClient();

  const { data: row, error } = await supabase
    .from("batches")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) return undefined;

  // Fetch cards
  const { data: cardRows } = await supabase
    .from("cards")
    .select("*")
    .eq("batch_id", id);

  // Fetch photos
  const cardIds = (cardRows || []).map((c) => c.id);
  let photoRows: Record<string, unknown>[] = [];
  if (cardIds.length > 0) {
    const { data } = await supabase
      .from("card_photos")
      .select("*")
      .in("card_id", cardIds);
    photoRows = (data || []) as Record<string, unknown>[];
  }

  const photosByCard = new Map<string, Record<string, unknown>[]>();
  for (const p of photoRows) {
    const cid = p.card_id as string;
    if (!photosByCard.has(cid)) photosByCard.set(cid, []);
    photosByCard.get(cid)!.push(p);
  }

  // Resolve signed URLs
  const allStoragePaths = photoRows
    .map((p) => p.storage_path as string)
    .filter(Boolean);
  const signedUrlMap = await getSignedUrls(allStoragePaths);

  const cards = (cardRows || []).map((c) =>
    dbCardToScanned(c as Record<string, unknown>, photosByCard.get(c.id) || [], signedUrlMap)
  );

  return {
    id: row.id,
    name: row.name,
    cards,
    status: row.status as BatchStatus,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function saveBatch(batch: Batch): Promise<void> {
  const supabase = createClient();
  const userId = await getUserId();

  // Upsert the batch row
  const { error: batchError } = await supabase.from("batches").upsert({
    id: batch.id,
    user_id: userId,
    name: batch.name,
    status: batch.status,
    updated_at: new Date().toISOString(),
  });
  if (batchError) throw batchError;

  // Fetch existing photo records so we can preserve storage paths
  // when photos come back as signed URLs after a read cycle.
  const { data: existingCards } = await supabase
    .from("cards")
    .select("id")
    .eq("batch_id", batch.id);
  const existingCardIds = (existingCards || []).map((c) => c.id);

  let existingPhotoMap = new Map<string, string>(); // photoId → storagePath
  if (existingCardIds.length > 0) {
    const { data: existingPhotos } = await supabase
      .from("card_photos")
      .select("id, storage_path")
      .in("card_id", existingCardIds);
    for (const p of existingPhotos || []) {
      existingPhotoMap.set(p.id, p.storage_path);
    }
  }

  // Delete existing cards (cascades to card_photos), then re-insert
  if (existingCardIds.length > 0) {
    await supabase.from("cards").delete().eq("batch_id", batch.id);
  }

  if (batch.cards.length > 0) {
    const cardRows = batch.cards.map((c) => scannedToDbCard(c, batch.id, userId));
    const { error: cardsError } = await supabase.from("cards").insert(cardRows);
    if (cardsError) throw cardsError;

    // Upload new photos and re-insert photo references
    const photoRows: Record<string, unknown>[] = [];
    for (const card of batch.cards) {
      for (const photo of card.photos || []) {
        if (!photo.dataUrl) continue;

        let storagePath: string;
        if (photo.dataUrl.startsWith("data:")) {
          // New photo — upload to Supabase Storage
          try {
            storagePath = await uploadPhoto(userId, card.id, photo.id, photo.dataUrl);
          } catch (err) {
            console.error("Photo upload failed:", err);
            continue;
          }
        } else if (existingPhotoMap.has(photo.id)) {
          // Photo was previously saved — reuse the known storage path
          storagePath = existingPhotoMap.get(photo.id)!;
        } else if (!photo.dataUrl.startsWith("http")) {
          // Already a raw storage path
          storagePath = photo.dataUrl;
        } else {
          // Signed URL with no matching existing record — skip
          continue;
        }

        photoRows.push({
          id: photo.id,
          card_id: card.id,
          role: photo.role,
          storage_path: storagePath,
        });
      }
    }
    if (photoRows.length > 0) {
      await supabase.from("card_photos").insert(photoRows);
    }
  }
}

export async function updateBatchCards(
  id: string,
  cards: ScannedCard[]
): Promise<void> {
  const batch = await getBatch(id);
  if (!batch) return;
  batch.cards = cards;
  batch.updatedAt = Date.now();
  await saveBatch(batch);
}

export async function updateBatchStatus(
  id: string,
  status: BatchStatus
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("batches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBatch(id: string): Promise<void> {
  const supabase = createClient();
  // Cards and photos cascade-delete via foreign key
  const { error } = await supabase.from("batches").delete().eq("id", id);
  if (error) throw error;
}

export async function getBatchSummary(): Promise<BatchSummary> {
  const batches = await getAllBatches();
  let totalCards = 0;
  let totalPhotos = 0;
  let totalValue = 0;
  let pendingCount = 0;
  let readyCount = 0;
  let listedCount = 0;

  for (const b of batches) {
    totalCards += b.cards.length;
    totalPhotos += b.cards.reduce((s, c) => s + (c.photos?.length ?? 0), 0);
    totalValue += b.cards.reduce(
      (s, c) => s + (c.marketPriceUsd ?? 0) * (c.quantity || 1),
      0
    );
    if (b.status === "pending") pendingCount++;
    else if (b.status === "ready") readyCount++;
    else if (b.status === "listed") listedCount++;
  }

  return { totalCards, totalPhotos, totalValue, pendingCount, readyCount, listedCount };
}
