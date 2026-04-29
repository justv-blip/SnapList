// eBay Listing operations — create, update, delete, sync via eBay APIs.
//
// Uses the Inventory API (RESTful) for creating/managing offers, and
// the Browse/Sell APIs for ancillary operations.
//
// Server-side only — depends on ebayFetch which handles token management.

import { ebayFetch } from "./client";
import type { ScannedCard, Condition } from "../types";
import { GAME_LABELS } from "../types";
import { GRADING_COMPANY_LABELS } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EbayListingResult {
  success: boolean;
  listingId?: string;       // eBay item ID
  offerId?: string;         // eBay offer ID (Inventory API)
  sku?: string;             // SKU used
  url?: string;             // Direct link to the listing
  error?: string;
  warnings?: string[];
}

export interface EbayListingConfig {
  categoryId?: string;       // eBay category ID (e.g. "183454" for Pokemon)
  storeCategoryId?: string;  // User's eBay store category
  conditionId: string;       // eBay condition ID
  listPrice: number;         // USD
  quantity: number;
  shippingProfileId?: string;
  returnProfileId?: string;
  paymentProfileId?: string;
  listingDuration?: string;  // GTC, Days_7, etc.
  bestOfferEnabled?: boolean;
  freeShipping?: boolean;
}

// ---------------------------------------------------------------------------
// Condition mapping
// ---------------------------------------------------------------------------

const CONDITION_TO_EBAY_ID: Record<Condition, string> = {
  "Near Mint": "3000",
  "Lightly Played": "4000",
  "Moderately Played": "5000",
  "Heavily Played": "6000",
  "Damaged": "7000",
};

export function getEbayConditionId(condition: Condition, slabbed?: boolean): string {
  if (slabbed) return "2750"; // Graded
  return CONDITION_TO_EBAY_ID[condition] || "3000";
}

// ---------------------------------------------------------------------------
// Default eBay category IDs for TCGs
// ---------------------------------------------------------------------------

const GAME_CATEGORY_MAP: Partial<Record<string, string>> = {
  pokemon: "183454",       // Pokémon Individual Cards
  mtg: "38292",            // MTG Individual Cards
  yugioh: "60051",         // Yu-Gi-Oh Individual Cards
  onepiece: "183456",      // One Piece Cards
  digimon: "183457",       // Digimon Cards
  lorcana: "183455",       // Lorcana Cards
};

// ---------------------------------------------------------------------------
// Build eBay inventory item from ScannedCard
// ---------------------------------------------------------------------------

function buildInventoryItem(card: ScannedCard) {
  const gameName = GAME_LABELS[card.game] || card.game;
  const title = card.listingTitle || buildTitle(card);
  const description = card.listingDescription || buildDescription(card);

  const aspects: Record<string, string[]> = {
    "Card Name": [card.name],
    "Game": [gameName],
    "Language": [card.language || "English"],
  };

  if (card.setName) aspects["Set"] = [card.setName];
  if (card.rarity) aspects["Rarity"] = [card.rarity];
  if (card.collectorNumber) aspects["Card Number"] = [card.collectorNumber];
  if (card.foil) aspects["Finish"] = ["Foil"];
  if (card.slabbed && card.grading) {
    aspects["Professional Grader"] = [GRADING_COMPANY_LABELS[card.grading.company]];
    aspects["Grade"] = [card.grading.grade];
    if (card.grading.certNumber) aspects["Certification Number"] = [card.grading.certNumber];
  }

  return {
    product: {
      title: title.slice(0, 80), // eBay title limit
      description: description,
      aspects,
      imageUrls: card.imageUrl ? [card.imageUrl] : [],
    },
    condition: getEbayConditionId(card.condition, card.slabbed),
    conditionDescription: card.condition,
    availability: {
      shipToLocationAvailability: {
        quantity: card.quantity || 1,
      },
    },
  };
}

function buildTitle(card: ScannedCard): string {
  const parts: string[] = [card.name];
  if (card.setName) parts.push(card.setName);
  if (card.collectorNumber) parts.push(`#${card.collectorNumber}`);
  if (card.rarity) parts.push(card.rarity);
  if (card.foil) parts.push("Foil");
  if (card.slabbed && card.grading) {
    parts.push(`${GRADING_COMPANY_LABELS[card.grading.company]} ${card.grading.grade}`);
  }
  parts.push(card.condition);
  parts.push(GAME_LABELS[card.game] || "TCG");
  return parts.join(" ").slice(0, 80);
}

function buildDescription(card: ScannedCard): string {
  const gameName = GAME_LABELS[card.game] || card.game;
  let desc = `You are purchasing: ${card.name}`;
  if (card.setName) desc += ` from ${card.setName}`;
  desc += ` (${gameName}).`;
  desc += `\n\nCondition: ${card.condition}`;
  if (card.foil) desc += "\nFinish: Foil / Holofoil";
  if (card.collectorNumber) desc += `\nCard Number: ${card.collectorNumber}`;
  if (card.slabbed && card.grading) {
    desc += `\n\nGraded by ${GRADING_COMPANY_LABELS[card.grading.company]}: ${card.grading.grade}`;
    if (card.grading.certNumber) desc += `\nCert #: ${card.grading.certNumber}`;
  }
  desc += "\n\nCards are shipped in a penny sleeve and top loader for protection.";
  return desc;
}

// ---------------------------------------------------------------------------
// Create a listing (Inventory API flow)
// ---------------------------------------------------------------------------

export async function createListing(
  userId: string,
  card: ScannedCard,
  config: EbayListingConfig
): Promise<EbayListingResult> {
  const sku = card.sku || `tcg-${card.id}`;

  try {
    // Step 1: Create or update inventory item
    const inventoryItem = buildInventoryItem(card);
    const itemRes = await ebayFetch(userId, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      method: "PUT",
      body: JSON.stringify(inventoryItem),
    });

    if (!itemRes.ok && itemRes.status !== 204) {
      const err = await itemRes.json().catch(() => ({ message: "Unknown error" }));
      return {
        success: false,
        sku,
        error: `Failed to create inventory item: ${err.message || err.errors?.[0]?.message || JSON.stringify(err)}`,
      };
    }

    // Step 2: Create offer
    const categoryId = config.categoryId || GAME_CATEGORY_MAP[card.game] || "183454";
    const offer = {
      sku,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      listingDescription: card.listingDescription || buildDescription(card),
      availableQuantity: config.quantity || card.quantity || 1,
      categoryId,
      listingPolicies: {
        ...(config.shippingProfileId ? { shippingPolicyId: config.shippingProfileId } : {}),
        ...(config.returnProfileId ? { returnPolicyId: config.returnProfileId } : {}),
        ...(config.paymentProfileId ? { paymentPolicyId: config.paymentProfileId } : {}),
        bestOfferTerms: config.bestOfferEnabled ? { bestOfferEnabled: true } : undefined,
      },
      pricingSummary: {
        price: {
          value: config.listPrice.toFixed(2),
          currency: "USD",
        },
      },
      ...(config.storeCategoryId ? { storeCategoryNames: [config.storeCategoryId] } : {}),
    };

    const offerRes = await ebayFetch(userId, "/sell/inventory/v1/offer", {
      method: "POST",
      body: JSON.stringify(offer),
    });

    if (!offerRes.ok) {
      const err = await offerRes.json().catch(() => ({ message: "Unknown error" }));
      return {
        success: false,
        sku,
        error: `Failed to create offer: ${err.message || err.errors?.[0]?.message || JSON.stringify(err)}`,
      };
    }

    const offerData = await offerRes.json();
    const offerId = offerData.offerId;

    // Step 3: Publish the offer to make it live
    const publishRes = await ebayFetch(userId, `/sell/inventory/v1/offer/${offerId}/publish`, {
      method: "POST",
    });

    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({ message: "Unknown error" }));
      return {
        success: false,
        sku,
        offerId,
        error: `Failed to publish listing: ${err.message || err.errors?.[0]?.message || JSON.stringify(err)}`,
        warnings: offerData.warnings?.map((w: { message: string }) => w.message),
      };
    }

    const publishData = await publishRes.json();
    const listingId = publishData.listingId;

    return {
      success: true,
      listingId,
      offerId,
      sku,
      url: `https://www.ebay.com/itm/${listingId}`,
      warnings: offerData.warnings?.map((w: { message: string }) => w.message),
    };
  } catch (err: unknown) {
    return {
      success: false,
      sku,
      error: `Listing creation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Update an existing listing
// ---------------------------------------------------------------------------

export async function updateListing(
  userId: string,
  offerId: string,
  updates: {
    price?: number;
    quantity?: number;
    description?: string;
  }
): Promise<EbayListingResult> {
  try {
    const body: Record<string, unknown> = {};
    if (updates.price != null) {
      body.pricingSummary = {
        price: { value: updates.price.toFixed(2), currency: "USD" },
      };
    }
    if (updates.quantity != null) {
      body.availableQuantity = updates.quantity;
    }
    if (updates.description) {
      body.listingDescription = updates.description;
    }

    const res = await ebayFetch(userId, `/sell/inventory/v1/offer/${offerId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown error" }));
      return {
        success: false,
        offerId,
        error: `Update failed: ${err.message || err.errors?.[0]?.message || JSON.stringify(err)}`,
      };
    }

    return { success: true, offerId };
  } catch (err: unknown) {
    return {
      success: false,
      offerId,
      error: `Update failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Delete / end a listing
// ---------------------------------------------------------------------------

export async function deleteListing(
  userId: string,
  sku: string
): Promise<EbayListingResult> {
  try {
    // Delete the offer first, then the inventory item
    const offersRes = await ebayFetch(userId, `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`);
    if (offersRes.ok) {
      const offersData = await offersRes.json();
      for (const offer of offersData.offers || []) {
        // Withdraw the offer (ends the listing)
        await ebayFetch(userId, `/sell/inventory/v1/offer/${offer.offerId}/withdraw`, {
          method: "POST",
        });
      }
    }

    // Delete the inventory item
    const delRes = await ebayFetch(userId, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      method: "DELETE",
    });

    if (!delRes.ok && delRes.status !== 204) {
      const err = await delRes.json().catch(() => ({ message: "Unknown error" }));
      return {
        success: false,
        sku,
        error: `Delete failed: ${err.message || JSON.stringify(err)}`,
      };
    }

    return { success: true, sku };
  } catch (err: unknown) {
    return {
      success: false,
      sku,
      error: `Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Bulk list multiple cards
// ---------------------------------------------------------------------------

export async function bulkCreateListings(
  userId: string,
  cards: ScannedCard[],
  configFn: (card: ScannedCard) => EbayListingConfig
): Promise<EbayListingResult[]> {
  const results: EbayListingResult[] = [];
  // Process sequentially to avoid eBay rate limits
  for (const card of cards) {
    const config = configFn(card);
    const result = await createListing(userId, card, config);
    results.push(result);
    // Small delay between listings to be respectful of rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Get user's eBay fulfillment policies (for shipping/return/payment dropdowns)
// ---------------------------------------------------------------------------

export async function getFulfillmentPolicies(
  userId: string,
  policyType: "fulfillment" | "return" | "payment"
): Promise<{ id: string; name: string }[]> {
  try {
    const typeMap = {
      fulfillment: "fulfillment_policy",
      return: "return_policy",
      payment: "payment_policy",
    };
    const res = await ebayFetch(
      userId,
      `/sell/account/v1/${typeMap[policyType]}?marketplace_id=EBAY_US`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const key = `${typeMap[policyType]}` + (policyType === "fulfillment" ? "" : "");
    const policies = data[`${policyType}Policies`] || data.policies || [];
    return policies.map((p: Record<string, string>) => ({
      id: p[`${policyType}PolicyId`] || p.id,
      name: p.name,
    }));
  } catch {
    return [];
  }
}
