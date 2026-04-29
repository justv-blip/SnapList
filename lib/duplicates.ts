/**
 * Duplicate detection & merging utilities for scanned cards.
 *
 * Two cards are considered "potential duplicates" when their core identity
 * fields match (name + set + collector number + game), even if they were
 * scanned as separate images. Confidence is boosted when condition, foil
 * status, and language also match.
 */

import type { ScannedCard } from "./types";

export interface DuplicateGroup {
  /** The card we recommend keeping (highest confidence or earliest scan). */
  primary: ScannedCard;
  /** All other cards in this duplicate group. */
  duplicates: ScannedCard[];
  /** 0-1 confidence that these are truly the same card. */
  confidence: number;
}

/** Normalise a string for fuzzy comparison. */
function norm(s?: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Generate a fingerprint for a card's core identity.
 * Cards sharing a fingerprint are candidates for dedup.
 */
function fingerprint(card: ScannedCard): string {
  const parts = [norm(card.name), norm(card.game)];
  if (card.setCode) parts.push(norm(card.setCode));
  else if (card.setName) parts.push(norm(card.setName));
  if (card.collectorNumber) parts.push(norm(card.collectorNumber));
  return parts.join("|");
}

/**
 * Compute a similarity score (0-1) between two cards that share a fingerprint.
 * Higher means more likely the exact same physical card.
 */
function similarity(a: ScannedCard, b: ScannedCard): number {
  let score = 0.6; // Base score for matching fingerprint

  if (a.condition === b.condition) score += 0.1;
  if (a.foil === b.foil) score += 0.1;
  if (norm(a.language) === norm(b.language)) score += 0.1;
  if (a.rarity && b.rarity && norm(a.rarity) === norm(b.rarity)) score += 0.05;
  if (a.slabbed === b.slabbed) score += 0.05;

  return Math.min(score, 1);
}

/**
 * Detect duplicate groups among a list of cards.
 * Returns groups where 2+ cards share the same identity fingerprint.
 */
export function detectDuplicates(cards: ScannedCard[]): DuplicateGroup[] {
  const buckets = new Map<string, ScannedCard[]>();

  for (const card of cards) {
    const fp = fingerprint(card);
    if (!fp || norm(card.name) === "") continue;
    const bucket = buckets.get(fp) || [];
    bucket.push(card);
    buckets.set(fp, bucket);
  }

  const groups: DuplicateGroup[] = [];

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;

    // Sort: highest confidence first, then earliest creation
    const sorted = [...bucket].sort((a, b) => {
      const confDiff = (b.identificationConfidence ?? 0) - (a.identificationConfidence ?? 0);
      if (confDiff !== 0) return confDiff;
      return a.createdAt - b.createdAt;
    });

    const primary = sorted[0];
    const duplicates = sorted.slice(1);
    const confidence = duplicates.reduce(
      (max, d) => Math.max(max, similarity(primary, d)),
      0
    );

    groups.push({ primary, duplicates, confidence });
  }

  // Sort by highest confidence first
  return groups.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Merge a duplicate into a primary card.
 * Keeps the primary's identity fields but merges photos and picks the best price.
 */
export function mergeCards(primary: ScannedCard, duplicate: ScannedCard): ScannedCard {
  // Merge photos — avoid exact URL duplicates
  const existingUrls = new Set(primary.photos.map((p) => p.dataUrl));
  const newPhotos = duplicate.photos.filter((p) => !existingUrls.has(p.dataUrl));

  return {
    ...primary,
    photos: [...primary.photos, ...newPhotos],
    // Take the better market price if primary is missing one
    marketPriceUsd:
      primary.marketPriceUsd ?? duplicate.marketPriceUsd,
    listPrice: primary.listPrice ?? duplicate.listPrice,
    // Sum quantities (both physical cards exist)
    quantity: primary.quantity + duplicate.quantity,
    // Keep the higher confidence identification
    identificationConfidence: Math.max(
      primary.identificationConfidence ?? 0,
      duplicate.identificationConfidence ?? 0
    ),
    // Preserve notes from both
    notes: [primary.notes, duplicate.notes].filter(Boolean).join(" | ") || undefined,
  };
}

/**
 * Auto-merge all detected duplicates and return a clean card list.
 * Removes duplicates and replaces them with merged primaries.
 */
export function deduplicateCards(cards: ScannedCard[]): {
  cards: ScannedCard[];
  mergedCount: number;
} {
  const groups = detectDuplicates(cards);
  if (groups.length === 0) return { cards, mergedCount: 0 };

  const removedIds = new Set<string>();
  const mergedPrimaries = new Map<string, ScannedCard>();

  for (const group of groups) {
    let merged = group.primary;
    for (const dup of group.duplicates) {
      merged = mergeCards(merged, dup);
      removedIds.add(dup.id);
    }
    mergedPrimaries.set(group.primary.id, merged);
  }

  const result = cards
    .filter((c) => !removedIds.has(c.id))
    .map((c) => mergedPrimaries.get(c.id) ?? c);

  return { cards: result, mergedCount: removedIds.size };
}
