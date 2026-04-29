// Listing template engine — resolves {variable} patterns into real values.

import type { Game, ListingTemplate, ScannedCard, ExportPlatform } from "./types";
import { GAME_LABELS, GRADING_COMPANY_LABELS } from "./types";
import { v4 as uuid } from "uuid";

// ============================================================
//  Resolve a template pattern against a card
// ============================================================

export function resolveTemplate(pattern: string, card: ScannedCard): string {
  const vars: Record<string, string> = {
    name: card.name || "",
    game: card.game || "",
    gameFull: GAME_LABELS[card.game] || card.game || "",
    setName: card.setName || "",
    setCode: card.setCode || "",
    collectorNumber: card.collectorNumber || "",
    rarity: card.rarity || "",
    condition: card.condition || "",
    foil: card.foil ? "Foil" : "",
    language: card.language || "English",
    price: card.marketPriceUsd != null ? `$${card.marketPriceUsd.toFixed(2)}` : "",
    gradingCompany: card.grading ? (GRADING_COMPANY_LABELS[card.grading.company] || "") : "",
    grade: card.grading?.grade || "",
    certNumber: card.grading?.certNumber || "",
    slabbed: card.slabbed ? "Graded" : "",
    sku: card.sku || "",
  };

  let result = pattern;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }

  // Clean up: collapse multiple spaces, trim
  return result.replace(/\s{2,}/g, " ").trim();
}

// ============================================================
//  Default templates
// ============================================================

export const DEFAULT_TEMPLATES: ListingTemplate[] = [
  {
    id: "ebay-pokemon",
    name: "eBay — Pokémon",
    titlePattern: "{name} {setName} {collectorNumber} {rarity} {condition} {foil} Pokemon TCG",
    descriptionPattern:
      "You are purchasing: {name} from {setName} (#{collectorNumber}).\n\nCondition: {condition}\nRarity: {rarity}\nLanguage: {language}\n{foil}\n\nShipped in a penny sleeve and top loader. Cards ship within 1 business day.",
    platform: "ebay",
    game: "pokemon",
  },
  {
    id: "ebay-mtg",
    name: "eBay — Magic: The Gathering",
    titlePattern: "{name} {setName} {collectorNumber} {rarity} {condition} {foil} MTG Magic",
    descriptionPattern:
      "You are purchasing: {name} from {setName} ({setCode} #{collectorNumber}).\n\nCondition: {condition}\nRarity: {rarity}\nLanguage: {language}\n{foil}\n\nShipped in a penny sleeve and top loader. Cards ship within 1 business day.",
    platform: "ebay",
    game: "mtg",
  },
  {
    id: "ebay-yugioh",
    name: "eBay — Yu-Gi-Oh!",
    titlePattern: "{name} {setCode} {rarity} {condition} {foil} Yu-Gi-Oh! YGO",
    descriptionPattern:
      "You are purchasing: {name} ({setCode}).\n\nCondition: {condition}\nRarity: {rarity}\nLanguage: {language}\n{foil}\n\nShipped in a penny sleeve and top loader. Cards ship within 1 business day.",
    platform: "ebay",
    game: "yugioh",
  },
  {
    id: "ebay-generic",
    name: "eBay — Any TCG",
    titlePattern: "{name} {setName} {collectorNumber} {rarity} {condition} {foil} {gameFull}",
    descriptionPattern:
      "You are purchasing: {name} from {setName}.\n\nGame: {gameFull}\nCondition: {condition}\nRarity: {rarity}\nLanguage: {language}\n{foil}\n\nShipped in a penny sleeve and top loader. Cards ship within 1 business day.",
    platform: "ebay",
  },
  {
    id: "tcgplayer-generic",
    name: "TCGPlayer — Any TCG",
    titlePattern: "{name} {setName} {collectorNumber}",
    descriptionPattern: "{condition} {foil} {language}",
    platform: "tcgplayer",
  },
  {
    id: "generic",
    name: "Generic CSV",
    titlePattern: "{name} — {setName} #{collectorNumber} ({rarity})",
    descriptionPattern: "{gameFull} | {condition} | {foil} | {language}",
    platform: "generic",
  },
];

// Find the best template for a card + platform combo
export function findBestTemplate(
  templates: ListingTemplate[],
  card: ScannedCard,
  platform: ExportPlatform
): ListingTemplate | undefined {
  // Prefer a game-specific template for the platform
  const gameSpecific = templates.find(
    (t) => t.platform === platform && t.game === card.game
  );
  if (gameSpecific) return gameSpecific;

  // Fall back to a platform template with no game filter
  return templates.find((t) => t.platform === platform && !t.game);
}

// Generate listing title for a card
export function generateListingTitle(
  card: ScannedCard,
  templates: ListingTemplate[],
  platform: ExportPlatform = "ebay"
): string {
  // If card has a custom title override, use it
  if (card.listingTitle) return card.listingTitle;

  const template = findBestTemplate(templates, card, platform);
  if (!template) return card.name || "TCG Card";

  return resolveTemplate(template.titlePattern, card);
}

// Generate listing description for a card
export function generateListingDescription(
  card: ScannedCard,
  templates: ListingTemplate[],
  platform: ExportPlatform = "ebay"
): string {
  if (card.listingDescription) return card.listingDescription;

  const template = findBestTemplate(templates, card, platform);
  if (!template) return "";

  return resolveTemplate(template.descriptionPattern, card);
}

// Create a blank custom template
export function createBlankTemplate(
  platform: ExportPlatform = "ebay"
): ListingTemplate {
  return {
    id: uuid(),
    name: "Custom Template",
    titlePattern: "{name} {setName} {collectorNumber} {rarity} {condition} {foil}",
    descriptionPattern: "You are purchasing: {name} from {setName}.\n\nCondition: {condition}",
    platform,
  };
}
