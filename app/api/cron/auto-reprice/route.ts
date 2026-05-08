// GET /api/cron/auto-reprice
// Called daily by Vercel Cron at 10:00 UTC.
// For each user who has auto_reprice_enabled = true:
//   1. Fetch their active eBay listings
//   2. Look up current market prices via TCG APIs
//   3. For listings where the price deviates beyond their threshold %, update
//   4. Stamp auto_reprice_last_run_at on the profile
//
// Protected by CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveListings, updateListing } from "@/lib/ebay/listings";
import { lookupCard } from "@/lib/tcgApis";
import { logger } from "@/lib/logger";
import type { Game } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Mirror of the game-inference from the reprice route
function inferGame(title: string): Game {
  const t = title.toLowerCase();
  if (t.includes("magic") || t.includes("mtg")) return "mtg";
  if (t.includes("yu-gi-oh") || t.includes("yugioh")) return "yugioh";
  if (t.includes("one piece")) return "onepiece";
  if (t.includes("digimon")) return "digimon";
  if (t.includes("lorcana")) return "lorcana";
  if (t.includes("flesh and blood")) return "fleshandblood";
  if (t.includes("dragon ball")) return "dragonball";
  if (t.includes("weiss schwarz")) return "weissschwarz";
  if (t.includes("gundam")) return "gundam";
  if (t.includes("vanguard")) return "vanguard";
  if (t.includes("topps") || t.includes("panini") || t.includes("nfl") || t.includes("nba")) return "sports";
  return "pokemon";
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      logger.warn("cron/auto-reprice: unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find all users with auto-reprice enabled
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, auto_reprice_threshold_pct")
    .eq("auto_reprice_enabled", true);

  if (error) {
    logger.error("cron/auto-reprice: failed to fetch profiles", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    logger.info("cron/auto-reprice: no users opted in");
    return NextResponse.json({ ok: true, users: 0, repriced: 0 });
  }

  logger.info("cron/auto-reprice: processing users", { count: profiles.length });

  let totalRepriced = 0;
  let totalErrors = 0;

  for (const profile of profiles) {
    const userId: string = profile.id;
    const thresholdPct: number = profile.auto_reprice_threshold_pct ?? 10;

    try {
      const listings = await getActiveListings(userId);
      if (listings.length === 0) continue;

      // Enrich with market prices (cap at 30 per user to avoid rate limits)
      const toCheck = listings.slice(0, 30);
      const updates: { offerId: string; newPrice: number }[] = [];

      for (const listing of toCheck) {
        if (!listing.cardName || !listing.offerId) continue;
        try {
          const hit = await lookupCard({
            game: inferGame(listing.title),
            name: listing.cardName,
          });
          if (!hit?.marketPriceUsd) continue;

          const market = hit.marketPriceUsd;
          const current = listing.currentPrice;
          if (!current || current <= 0) continue;

          const deviation = Math.abs(market - current) / current;
          if (deviation * 100 >= thresholdPct) {
            updates.push({
              offerId: listing.offerId,
              newPrice: parseFloat(market.toFixed(2)),
            });
          }
        } catch {
          // skip this listing
        }
      }

      if (updates.length > 0) {
        // Apply in parallel but limit concurrency
        const results = await Promise.allSettled(
          updates.map((u) => updateListing(userId, u.offerId, { price: u.newPrice }))
        );
        const succeeded = results.filter((r) => r.status === "fulfilled" && (r.value as { success: boolean }).success).length;
        totalRepriced += succeeded;
        totalErrors += updates.length - succeeded;
        logger.info("cron/auto-reprice: user done", { userId, updates: updates.length, succeeded });
      }

      // Stamp last run time
      await supabase
        .from("profiles")
        .update({ auto_reprice_last_run_at: new Date().toISOString() })
        .eq("id", userId);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      logger.error("cron/auto-reprice: user failed", { userId, message: msg });
      totalErrors++;
    }
  }

  return NextResponse.json({
    ok: true,
    users: profiles.length,
    repriced: totalRepriced,
    errors: totalErrors,
    ran_at: new Date().toISOString(),
  });
}
