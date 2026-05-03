// GET  /api/ebay/reprice — fetch active eBay listings enriched with market prices
// POST /api/ebay/reprice — update prices for selected listings

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { getActiveListings, updateListing, type ActiveListing } from "@/lib/ebay/listings";
import { lookupCard } from "@/lib/tcgApis";
import { sanitizeString } from "@/lib/validation";
import type { Game } from "@/lib/types";

// Infer game from listing title via keyword matching
function inferGameFromTitle(title: string): Game {
  const t = title.toLowerCase();
  if (t.includes("magic") || t.includes(" mtg ") || t.includes("the gathering")) return "mtg";
  if (t.includes("yu-gi-oh") || t.includes("yugioh") || t.includes("ygo")) return "yugioh";
  if (t.includes("one piece")) return "onepiece";
  if (t.includes("digimon")) return "digimon";
  if (t.includes("lorcana")) return "lorcana";
  if (t.includes("flesh and blood") || t.includes("flesh & blood")) return "fleshandblood";
  if (t.includes("dragon ball")) return "dragonball";
  if (t.includes("weiss schwarz") || t.includes("weiß schwarz")) return "weissschwarz";
  if (t.includes("final fantasy")) return "finalfantasy";
  if (t.includes("union arena")) return "unionarena";
  if (t.includes("battle spirits")) return "battlespirits";
  if (t.includes("gundam")) return "gundam";
  if (t.includes("vanguard")) return "vanguard";
  if (t.includes("riftbound") || t.includes("runeterra")) return "riftbound";
  // Sports: detect common brands/leagues before defaulting to Pokémon
  if (
    t.includes("topps") || t.includes("panini") || t.includes("upper deck") ||
    t.includes("bowman") || t.includes("prizm") || t.includes("donruss") ||
    t.includes("nfl") || t.includes("nba") || t.includes("mlb") || t.includes("nhl") ||
    t.includes("ufc") || t.includes("rookie card") || t.includes(" rc ")
  ) return "sports";
  return "pokemon"; // default
}

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
          game: inferGameFromTitle(listing.title),
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
