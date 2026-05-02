// GET  /api/ebay/reprice — fetch active eBay listings enriched with market prices
// POST /api/ebay/reprice — update prices for selected listings

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { getActiveListings, updateListing, type ActiveListing } from "@/lib/ebay/listings";
import { lookupCard } from "@/lib/tcgApis";
import { sanitizeString } from "@/lib/validation";
import type { Game } from "@/lib/types";

export const runtime = "nodejs";

export interface EnrichedListing extends ActiveListing {
  marketPrice?: number;
  suggestedPrice?: number;
}

// GET — return active listings with market price enrichment (up to 20 enriched)
export async function GET(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const listings = await getActiveListings(auth.user.id);

  if (listings.length === 0) {
    return NextResponse.json({ listings: [] });
  }

  // Enrich up to 20 listings with market prices to avoid rate limit issues
  const ENRICH_LIMIT = 20;
  const enriched: EnrichedListing[] = await Promise.all(
    listings.slice(0, ENRICH_LIMIT).map(async (listing): Promise<EnrichedListing> => {
      if (!listing.cardName) return listing;
      try {
        const hit = await lookupCard({
          game: "pokemon" as Game, // default; improve with game detection from SKU/title
          name: listing.cardName,
        });
        if (!hit?.marketPriceUsd) return listing;
        return {
          ...listing,
          marketPrice: hit.marketPriceUsd,
          suggestedPrice: parseFloat(hit.marketPriceUsd.toFixed(2)),
          game: hit.game,
          setName: hit.setName,
        };
      } catch {
        return listing;
      }
    })
  );

  // Append any listings beyond the enrichment limit without pricing
  const rest = listings.slice(ENRICH_LIMIT).map((l): EnrichedListing => l);

  return NextResponse.json({ listings: [...enriched, ...rest] });
}

// POST — reprice selected listings
export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates = body?.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  if (updates.length > 50) {
    return NextResponse.json({ error: "Max 50 updates per request" }, { status: 400 });
  }

  const results = await Promise.all(
    updates.map(async (u: any) => {
      const offerId = sanitizeString(u.offerId, 100);
      const newPrice = parseFloat(u.newPrice);
      if (!offerId || isNaN(newPrice) || newPrice <= 0) {
        return { offerId: u.offerId, success: false, error: "Invalid offerId or price" };
      }
      const result = await updateListing(auth.user.id, offerId, { price: newPrice });
      return { offerId, ...result };
    })
  );

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({ results, successCount, total: results.length });
}
