import { NextRequest, NextResponse } from "next/server";
import { computeSignal, trendFromChange, type MarketAnalysis } from "@/lib/marketAnalysis";
import { lookupCard } from "@/lib/tcgApis";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString, isValidGame } from "@/lib/validation";
import type { Game } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const body = await req.json();
    const cardName = sanitizeString(body?.cardName, 200);
    const game = body?.game as Game;
    const setName = sanitizeString(body?.setName, 200) || undefined;

    if (!cardName || !isValidGame(game)) {
      return NextResponse.json(
        { error: "cardName and a valid game are required" },
        { status: 400 }
      );
    }

    // Fetch current market price via the same lookup pipeline used during scanning.
    const hit = await lookupCard({ game, name: cardName, setName });
    const currentPrice = hit?.marketPriceUsd ?? 0;

    // We only have a single current price point — no historical data yet.
    // Treat current price as both the 30-day and 90-day average, which means
    // all change percentages are 0 and the trend is stable.
    // This is honest: we have real price data, but no history to compute trends from.
    const avg30d = currentPrice;
    const avg90d = currentPrice;
    const change7d = 0;
    const change30d = 0;

    const { signal, confidence, reasoning } = computeSignal(
      currentPrice,
      avg30d,
      avg90d,
      change7d,
      change30d
    );

    // Enrich the reasoning with a note about data availability.
    const enrichedReasoning = currentPrice > 0
      ? `Current market price: $${currentPrice.toFixed(2)}. ${reasoning} Price history and trend data are on the roadmap.`
      : "No market price found for this card. Try searching with the exact card name and set.";

    return NextResponse.json({
      cardName: hit?.name ?? cardName,
      game,
      setName: hit?.setName ?? setName,
      currentPrice,
      averagePrice30d: avg30d,
      averagePrice90d: avg90d,
      trend7d: trendFromChange(change7d),
      trend30d: trendFromChange(change30d),
      priceChange7dPercent: change7d,
      priceChange30dPercent: change30d,
      signal: currentPrice > 0 ? signal : "hold",
      signalConfidence: currentPrice > 0 ? confidence : 0,
      signalReasoning: enrichedReasoning,
      priceHistory: [],
      source: "internal",
      lastUpdated: new Date().toISOString(),
    } satisfies MarketAnalysis);
  } catch (err: any) {
    console.error("[market-analysis] error", err?.message);
    return NextResponse.json(
      { error: "Failed to analyze market data" },
      { status: 500 }
    );
  }
}
