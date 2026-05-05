// Input validation helpers for API routes.
// Prevents injection, enforces size limits, and sanitizes user input.

/** Strip control characters and trim whitespace. */
export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== "string") return "";
  // Remove control chars (except newline/tab in descriptions)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

/** Validate that a value is one of the allowed options. */
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

/** Validate a game identifier. Derived from the canonical GAMES array in lib/types.ts. */
import { GAMES } from "@/lib/types";
export function isValidGame(game: unknown): game is (typeof GAMES)[number] {
  return isOneOf(game, GAMES);
}

/** Validate export format. */
const VALID_EXPORT_FORMATS = ["ebay", "tcgplayer", "whatnot", "shopify", "squarespace", "json", "csv"] as const;
export function isValidExportFormat(fmt: unknown): fmt is typeof VALID_EXPORT_FORMATS[number] {
  return isOneOf(fmt, VALID_EXPORT_FORMATS);
}

/** Validate a grading company identifier. */
const VALID_GRADING_COMPANIES = ["psa", "bgs", "cgc", "sgc", "tag", "ars"] as const;
export function isValidGradingCompany(company: unknown): company is typeof VALID_GRADING_COMPANIES[number] {
  return isOneOf(company, VALID_GRADING_COMPANIES);
}

/** Check that a number is a safe, finite value within a range. */
export function isSafeNumber(value: unknown, min = 0, max = 1_000_000): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/** Validate a card object from export/save requests. Returns sanitized version or null. */
export function sanitizeCardForExport(card: Record<string, unknown>): Record<string, unknown> | null {
  if (!card || typeof card !== "object") return null;

  return {
    id: sanitizeString(card.id, 100),
    game: isValidGame(card.game) ? card.game : undefined,
    name: sanitizeString(card.name, 200),
    setName: sanitizeString(card.setName, 200),
    setCode: sanitizeString(card.setCode, 20),
    collectorNumber: sanitizeString(card.collectorNumber, 20),
    rarity: sanitizeString(card.rarity, 50),
    condition: sanitizeString(card.condition, 30),
    quantity: isSafeNumber(card.quantity, 1, 9999) ? card.quantity : 1,
    foil: typeof card.foil === "boolean" ? card.foil : false,
    language: sanitizeString(card.language, 30) || "English",
    notes: sanitizeString(card.notes, 1000),
    marketPriceUsd: isSafeNumber(card.marketPriceUsd, 0, 999999) ? card.marketPriceUsd : undefined,
    listingTitle: sanitizeString(card.listingTitle, 300),
    listingDescription: sanitizeString(card.listingDescription, 5000),
    imageUrl: sanitizeString(card.imageUrl, 500),
    photos: Array.isArray(card.photos) ? card.photos : [],
    slabbed: typeof card.slabbed === "boolean" ? card.slabbed : false,
    grading: card.grading && typeof card.grading === "object" ? {
      company: isValidGradingCompany((card.grading as Record<string, unknown>).company)
        ? (card.grading as Record<string, unknown>).company
        : undefined,
      grade: sanitizeString((card.grading as Record<string, unknown>).grade, 30),
      certNumber: sanitizeString((card.grading as Record<string, unknown>).certNumber, 50),
    } : undefined,
    sku: sanitizeString(card.sku, 100),
  };
}

/** Max payload sizes (bytes) */
export const MAX_PAYLOAD = {
  /** Max JSON body for lookup requests */
  lookup: 2 * 1024, // 2 KB
  /** Max JSON body for export requests */
  export: 5 * 1024 * 1024, // 5 MB (large inventories)
  /** Max cards in a single export */
  exportCards: 5000,
  /** Max file size for scan images (10 MB) */
  scanImage: 10 * 1024 * 1024,
  /** Max images per scan request */
  scanBatch: 20,
};
