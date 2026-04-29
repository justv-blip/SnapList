// POST /api/ebay/list — Push one or more cards as eBay listings.
//
// Body: { cards: ScannedCard[], config: Partial<EbayListingConfig> }
// - cards: array of ScannedCard objects from the scanner
// - config: shared listing config (price, condition, shipping profile, etc.)
//   Each card can also carry its own overrides (card.listPrice, etc.)
//
// Returns: { results: EbayListingResult[] }

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import {
  createListing,
  bulkCreateListings,
  getEbayConditionId,
  type EbayListingConfig,
  type EbayListingResult,
} from "@/lib/ebay/listings";
import { isEbayConnected } from "@/lib/ebay/client";
import type { ScannedCard } from "@/lib/types";
import { validateBatch } from "@/lib/listingValidation";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    // Verify eBay is connected
    const connected = await isEbayConnected(user.id);
    if (!connected) {
      return NextResponse.json(
        { error: "eBay not connected. Go to Settings to connect your eBay account." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { cards, config } = body as {
      cards: ScannedCard[];
      config?: Partial<EbayListingConfig>;
    };

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: "At least one card is required." },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse / rate limit issues
    if (cards.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 cards per listing request." },
        { status: 400 }
      );
    }

    // Server-side validation gate — reject if any card has blocking errors.
    // The client runs this too, but we can't trust client-side checks alone.
    const validation = validateBatch(cards, "ebay");
    if (!validation.isValid) {
      const errorCards = validation.cards
        .filter((c) => c.hasErrors)
        .map((c) => ({ cardName: c.cardName, issues: c.issues.filter((i) => i.severity === "error") }));

      return NextResponse.json(
        {
          error: "Validation failed — fix errors before listing.",
          validation: {
            summary: validation.summary,
            totalErrors: validation.totalErrors,
            totalWarnings: validation.totalWarnings,
            batchIssues: validation.batchIssues.filter((i) => i.severity === "error"),
            cardErrors: errorCards,
          },
        },
        { status: 422 }
      );
    }

    // Build per-card config — merges shared config with card-level overrides
    const configFn = (card: ScannedCard): EbayListingConfig => {
      const listPrice =
        card.listPrice ??
        card.marketPriceUsd ??
        config?.listPrice ??
        0.99;

      return {
        conditionId: getEbayConditionId(card.condition, card.slabbed),
        listPrice,
        quantity: card.quantity || 1,
        bestOfferEnabled: config?.bestOfferEnabled ?? true,
        freeShipping: config?.freeShipping ?? false,
        categoryId: config?.categoryId,
        storeCategoryId: config?.storeCategoryId,
        shippingProfileId: config?.shippingProfileId,
        returnProfileId: config?.returnProfileId,
        paymentProfileId: config?.paymentProfileId,
        listingDuration: config?.listingDuration ?? "GTC",
      };
    };

    let results: EbayListingResult[];

    if (cards.length === 1) {
      const result = await createListing(user.id, cards[0], configFn(cards[0]));
      results = [result];
    } else {
      results = await bulkCreateListings(user.id, cards, configFn);
    }

    const successes = results.filter((r) => r.success).length;
    const failures = results.length - successes;

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successes,
        failures,
      },
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
