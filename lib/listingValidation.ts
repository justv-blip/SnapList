// Listing validation engine — pre-flight checks before export or direct listing.
//
// Validates cards against platform-specific rules (eBay title length, required
// fields, condition mappings, etc.) and universal quality checks (missing price,
// low confidence, no photos). Returns structured results so the UI can block on
// errors and warn on potential issues.

import type { ScannedCard, ExportPlatform } from "./types";
import { GAME_LABELS, GRADING_COMPANY_LABELS } from "./types";
import { generateListingTitle, generateListingDescription, DEFAULT_TEMPLATES } from "./templates";
import type { ListingTemplate } from "./types";

// ---- Types ----

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;           // machine-readable code (e.g. "TITLE_TOO_LONG")
  message: string;        // human-readable description
  field?: string;         // which field is affected (e.g. "name", "marketPriceUsd")
  suggestion?: string;    // actionable fix suggestion
}

export interface CardValidationResult {
  cardId: string;
  cardName: string;
  issues: ValidationIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface BatchValidationResult {
  cards: CardValidationResult[];
  batchIssues: ValidationIssue[];     // issues that apply to the batch as a whole
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  isValid: boolean;                    // true if zero errors (warnings are OK)
  summary: string;                     // human-readable summary
}

// ---- Platform-specific constraints ----

interface PlatformConstraints {
  maxTitleLength: number;
  requiresPrice: boolean;
  requiresCondition: boolean;
  requiresPhotos: boolean;
  requiresSetName: boolean;
  requiresCollectorNumber: boolean;
  minPrice: number;
  maxPrice: number;
}

const PLATFORM_CONSTRAINTS: Record<ExportPlatform, PlatformConstraints> = {
  ebay: {
    maxTitleLength: 80,
    requiresPrice: true,
    requiresCondition: true,
    requiresPhotos: true,
    requiresSetName: false,
    requiresCollectorNumber: false,
    minPrice: 0.99,
    maxPrice: 25000,
  },
  tcgplayer: {
    maxTitleLength: 200,
    requiresPrice: true,
    requiresCondition: true,
    requiresPhotos: false,
    requiresSetName: true,
    requiresCollectorNumber: true,
    minPrice: 0.25,
    maxPrice: 99999,
  },
  whatnot: {
    maxTitleLength: 100,
    requiresPrice: true,
    requiresCondition: true,
    requiresPhotos: true,
    requiresSetName: false,
    requiresCollectorNumber: false,
    minPrice: 0.99,
    maxPrice: 50000,
  },
  shopify: {
    maxTitleLength: 255,
    requiresPrice: true,
    requiresCondition: false,
    requiresPhotos: false,
    requiresSetName: false,
    requiresCollectorNumber: false,
    minPrice: 0.01,
    maxPrice: 999999,
  },
  squarespace: {
    maxTitleLength: 255,
    requiresPrice: true,
    requiresCondition: false,
    requiresPhotos: false,
    requiresSetName: false,
    requiresCollectorNumber: false,
    minPrice: 0.01,
    maxPrice: 999999,
  },
  generic: {
    maxTitleLength: 500,
    requiresPrice: false,
    requiresCondition: false,
    requiresPhotos: false,
    requiresSetName: false,
    requiresCollectorNumber: false,
    minPrice: 0,
    maxPrice: 999999,
  },
};

// ---- Core validation ----

export function validateCard(
  card: ScannedCard,
  platform: ExportPlatform,
  templates?: ListingTemplate[]
): CardValidationResult {
  const issues: ValidationIssue[] = [];
  const constraints = PLATFORM_CONSTRAINTS[platform];
  const tmpl = templates && templates.length > 0 ? templates : DEFAULT_TEMPLATES;

  // Generate the title that would be used for export
  const generatedTitle = generateListingTitle(card, tmpl, platform === "generic" ? "generic" : platform);

  // ---- Universal checks (apply to all platforms) ----

  // Missing card name
  if (!card.name || card.name.trim() === "") {
    issues.push({
      severity: "error",
      code: "MISSING_NAME",
      message: "Card name is missing",
      field: "name",
      suggestion: "Enter the card name manually or re-scan the card",
    });
  }

  // Low identification confidence
  if (card.identificationSource === "vision" && card.identificationConfidence != null) {
    if (card.identificationConfidence < 0.5) {
      issues.push({
        severity: "error",
        code: "VERY_LOW_CONFIDENCE",
        message: `AI identification confidence is very low (${Math.round(card.identificationConfidence * 100)}%)`,
        field: "identificationConfidence",
        suggestion: "Manually verify the card name, set, and number before listing",
      });
    } else if (card.identificationConfidence < 0.75) {
      issues.push({
        severity: "warning",
        code: "LOW_CONFIDENCE",
        message: `AI identification confidence is ${Math.round(card.identificationConfidence * 100)}% — verify before listing`,
        field: "identificationConfidence",
        suggestion: "Double-check the card name and set against the physical card",
      });
    }
  }

  // No photos at all
  if ((!card.photos || card.photos.length === 0) && !card.imageUrl) {
    if (constraints.requiresPhotos) {
      issues.push({
        severity: "error",
        code: "NO_PHOTOS",
        message: "No photos attached — this platform requires at least one image",
        field: "photos",
        suggestion: "Upload a photo of the card or use the camera scanner",
      });
    } else {
      issues.push({
        severity: "info",
        code: "NO_PHOTOS_INFO",
        message: "No user photos — only the API image will be used",
        field: "photos",
        suggestion: "Adding your own photos increases buyer trust and sale speed",
      });
    }
  }

  // Graded card checks
  if (card.slabbed) {
    if (!card.grading?.company) {
      issues.push({
        severity: "error",
        code: "GRADED_NO_COMPANY",
        message: "Card is marked as graded but no grading company is set",
        field: "grading.company",
        suggestion: "Select the grading company (PSA, BGS, CGC, etc.)",
      });
    }
    if (!card.grading?.grade) {
      issues.push({
        severity: "error",
        code: "GRADED_NO_GRADE",
        message: "Card is marked as graded but no grade is set",
        field: "grading.grade",
        suggestion: "Enter the grade number from the slab label",
      });
    }
    if (card.grading?.company && card.grading?.certNumber && !card.grading.verified) {
      issues.push({
        severity: "warning",
        code: "CERT_NOT_VERIFIED",
        message: `${GRADING_COMPANY_LABELS[card.grading.company]} cert #${card.grading.certNumber} has not been verified`,
        field: "grading.verified",
        suggestion: "Use the cert verification tool to confirm authenticity",
      });
    }
  }

  // Quantity check
  if (card.quantity <= 0) {
    issues.push({
      severity: "error",
      code: "ZERO_QUANTITY",
      message: "Quantity is zero — nothing will be listed",
      field: "quantity",
      suggestion: "Set quantity to at least 1",
    });
  }

  // ---- Platform-specific checks ----

  // Title length
  if (generatedTitle.length > constraints.maxTitleLength) {
    issues.push({
      severity: "error",
      code: "TITLE_TOO_LONG",
      message: `Title is ${generatedTitle.length} chars (max ${constraints.maxTitleLength} for ${platform})`,
      field: "listingTitle",
      suggestion: `Shorten the title by ${generatedTitle.length - constraints.maxTitleLength} characters or adjust your template`,
    });
  }

  // Empty title
  if (generatedTitle.trim() === "") {
    issues.push({
      severity: "error",
      code: "EMPTY_TITLE",
      message: "Generated listing title is empty",
      field: "listingTitle",
      suggestion: "Check your listing template — it may have broken variable references",
    });
  }

  // Price checks
  const price = card.listPrice ?? card.marketPriceUsd ?? 0;
  if (constraints.requiresPrice && price <= 0) {
    issues.push({
      severity: "error",
      code: "MISSING_PRICE",
      message: "No price set — this platform requires a listing price",
      field: "marketPriceUsd",
      suggestion: "Set a market price or list price for this card",
    });
  }
  if (price > 0 && price < constraints.minPrice) {
    issues.push({
      severity: "error",
      code: "PRICE_TOO_LOW",
      message: `Price $${price.toFixed(2)} is below the platform minimum of $${constraints.minPrice.toFixed(2)}`,
      field: "marketPriceUsd",
      suggestion: `Raise the price to at least $${constraints.minPrice.toFixed(2)}`,
    });
  }
  if (price > constraints.maxPrice) {
    issues.push({
      severity: "warning",
      code: "PRICE_VERY_HIGH",
      message: `Price $${price.toFixed(2)} seems unusually high — verify this is correct`,
      field: "marketPriceUsd",
      suggestion: "Double-check the market price and your pricing strategy",
    });
  }

  // Suspicious pricing — price is $0 but card has a name (likely a lookup failure)
  if (price === 0 && card.name && card.name.trim() !== "") {
    issues.push({
      severity: "warning",
      code: "ZERO_PRICE_NAMED_CARD",
      message: "Card has a name but $0.00 price — price lookup may have failed",
      field: "marketPriceUsd",
      suggestion: "Check the market price manually or re-run price lookup",
    });
  }

  // Set name required
  if (constraints.requiresSetName && (!card.setName || card.setName.trim() === "")) {
    issues.push({
      severity: "error",
      code: "MISSING_SET_NAME",
      message: `Set name is required for ${platform}`,
      field: "setName",
      suggestion: "Enter the card's set name (e.g. 'Surging Sparks', 'Lost Origin')",
    });
  }

  // Collector number required
  if (constraints.requiresCollectorNumber && (!card.collectorNumber || card.collectorNumber.trim() === "")) {
    issues.push({
      severity: "warning",
      code: "MISSING_COLLECTOR_NUMBER",
      message: `Collector number is recommended for ${platform}`,
      field: "collectorNumber",
      suggestion: "Add the collector number from the card (e.g. '025/191')",
    });
  }

  // ---- eBay-specific checks ----
  if (platform === "ebay") {
    // eBay requires specific item specifics for TCG cards
    if (!card.game || card.game === "other") {
      issues.push({
        severity: "warning",
        code: "EBAY_UNKNOWN_GAME",
        message: "Game type is 'Other' — eBay listings perform better with a specific game category",
        field: "game",
        suggestion: "Select the correct TCG game for better search visibility",
      });
    }

    // Check for characters eBay doesn't allow in titles
    if (generatedTitle.includes("*") || generatedTitle.includes("!") || generatedTitle.includes("@")) {
      issues.push({
        severity: "warning",
        code: "EBAY_TITLE_SPECIAL_CHARS",
        message: "Title contains special characters (*, !, @) that eBay may strip or flag",
        field: "listingTitle",
        suggestion: "Remove special characters from the title",
      });
    }

    // eBay listing ID duplicate check
    if (card.ebayListingId) {
      issues.push({
        severity: "info",
        code: "EBAY_ALREADY_LISTED",
        message: `Already listed on eBay (Item #${card.ebayListingId})`,
        field: "ebayListingId",
        suggestion: "This card will be skipped during eBay push — it's already live",
      });
    }
  }

  // ---- TCGPlayer-specific checks ----
  if (platform === "tcgplayer") {
    if (!card.rarity || card.rarity.trim() === "") {
      issues.push({
        severity: "warning",
        code: "TCGPLAYER_MISSING_RARITY",
        message: "Rarity not set — TCGPlayer uses rarity for product matching",
        field: "rarity",
        suggestion: "Set the rarity (Common, Uncommon, Rare, etc.)",
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  const hasWarnings = issues.some((i) => i.severity === "warning");

  return {
    cardId: card.id,
    cardName: card.name || "(unnamed card)",
    issues,
    hasErrors,
    hasWarnings,
  };
}

// ---- Batch validation ----

export function validateBatch(
  cards: ScannedCard[],
  platform: ExportPlatform,
  templates?: ListingTemplate[]
): BatchValidationResult {
  const batchIssues: ValidationIssue[] = [];

  // Batch-level checks
  if (cards.length === 0) {
    batchIssues.push({
      severity: "error",
      code: "EMPTY_BATCH",
      message: "No cards to export",
      suggestion: "Scan or add cards before exporting",
    });
  }

  if (cards.length > 200) {
    batchIssues.push({
      severity: "warning",
      code: "LARGE_BATCH",
      message: `Batch contains ${cards.length} cards — large exports may take longer to process on the platform`,
      suggestion: "Consider splitting into smaller batches for easier management",
    });
  }

  // Check for duplicate SKUs
  const skus = cards.filter((c) => c.sku).map((c) => c.sku!);
  const dupeSkus = skus.filter((s, i) => skus.indexOf(s) !== i);
  if (dupeSkus.length > 0) {
    batchIssues.push({
      severity: "error",
      code: "DUPLICATE_SKUS",
      message: `Duplicate SKUs found: ${[...new Set(dupeSkus)].join(", ")}`,
      suggestion: "Each card needs a unique SKU for inventory tracking",
    });
  }

  // Check for cards with identical names + conditions (possible unmerged duplicates)
  const fingerprints = new Map<string, number>();
  for (const c of cards) {
    const key = `${c.name}|${c.setName || ""}|${c.condition}|${c.foil}`;
    fingerprints.set(key, (fingerprints.get(key) || 0) + 1);
  }
  const possibleDupes = [...fingerprints.entries()].filter(([, count]) => count > 1);
  if (possibleDupes.length > 0) {
    batchIssues.push({
      severity: "warning",
      code: "POSSIBLE_DUPLICATES",
      message: `${possibleDupes.length} possible duplicate group(s) detected — consider merging`,
      suggestion: "Use the duplicate checker to review and merge before exporting",
    });
  }

  // Total batch value sanity check
  const totalValue = cards.reduce((sum, c) => sum + (c.listPrice ?? c.marketPriceUsd ?? 0) * c.quantity, 0);
  if (totalValue > 50000) {
    batchIssues.push({
      severity: "warning",
      code: "HIGH_BATCH_VALUE",
      message: `Total batch value is $${totalValue.toFixed(2)} — double-check pricing`,
      suggestion: "Review individual card prices to make sure there are no errors",
    });
  }

  // Validate each card
  const cardResults = cards.map((c) => validateCard(c, platform, templates));

  const totalErrors = batchIssues.filter((i) => i.severity === "error").length +
    cardResults.reduce((sum, r) => sum + r.issues.filter((i) => i.severity === "error").length, 0);
  const totalWarnings = batchIssues.filter((i) => i.severity === "warning").length +
    cardResults.reduce((sum, r) => sum + r.issues.filter((i) => i.severity === "warning").length, 0);
  const totalInfos = batchIssues.filter((i) => i.severity === "info").length +
    cardResults.reduce((sum, r) => sum + r.issues.filter((i) => i.severity === "info").length, 0);

  const isValid = totalErrors === 0;

  // Build summary
  let summary: string;
  if (isValid && totalWarnings === 0) {
    summary = `All ${cards.length} card${cards.length !== 1 ? "s" : ""} passed validation — ready to export`;
  } else if (isValid) {
    summary = `${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""} found — review recommended but you can proceed`;
  } else {
    summary = `${totalErrors} error${totalErrors !== 1 ? "s" : ""} must be fixed before exporting`;
  }

  return {
    cards: cardResults,
    batchIssues,
    totalErrors,
    totalWarnings,
    totalInfos,
    isValid,
    summary,
  };
}

// ---- Quick check for UI badge counts ----

export function quickValidationCounts(
  cards: ScannedCard[],
  platform: ExportPlatform
): { errors: number; warnings: number } {
  const result = validateBatch(cards, platform);
  return { errors: result.totalErrors, warnings: result.totalWarnings };
}
