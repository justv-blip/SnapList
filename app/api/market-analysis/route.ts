import { NextRequest, NextResponse } from "next/server";
import { computeSignal, trendFromChange, type MarketAnalysis } from "@/lib/marketAnalysis";
import { lookupCard } from "@/lib/tcgApis";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString, isValidGame } from "@/lib/validation";
import { recordPrice, getPriceTrend } from "@/lib/priceHistory";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Game } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  // Per-user rate limit: 30 market-analysis calls per minute
  const rl = checkRateLimit({ id: "market-analysis", limit: 30, windowSec: 60 }, auth.user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
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

    // Fetch current market price
    const hit = await lookupCard({ game, name: cardName, setName });
    const currentPrice = hit?.marketPriceUsd ?? 0;

    // Record this observation to price_history (best-effort)
    if (currentPrice > 0) {
      recordPrice(auth.supabase, auth.user.id, {
        game,
        name: hit?.name ?? cardName,
        setName: hit?.setName ?? setName,
        priceUsd: currentPrice,
        source: "market-analysis",
      });
    }

    // Fetch historical trend data from price_history table
    const trend = await getPriceTrend(
      auth.supabase,
      auth.user.id,
      game,
      hit?.name ?? cardName,
      hit?.setName ?? setName
    );

    const avg30d = trend?.avg30d ?? currentPrice;
    const avg90d = trend?.avg90d ?? currentPrice;
    const change7d = trend?.change7dPct ?? 0;
    const change30d = trend?.change30dPct ?? 0;

    const { signal, confidence, reasoning } = computeSignal(
      currentPrice,
      avg30d,
      avg90d,
      change7d,
      change30d
    );

    const hasHistory = (trend?.history?.length ?? 0) > 1;

    const enrichedReasoning = currentPrice > 0
      ? hasHistory
        ? reasoning
        : `Current market price: $${currentPrice.toFixed(2)}. ${reasoning} Price history will build up as you scan and look up cards.`
      : "No market price found for this card. Try searching with the exact card name and set.";

    // Map internal PricePoint to MarketDataPoint shape
    const priceHistory = (trend?.history ?? []).map((p) => ({
      date: p.date.slice(0, 10), // ISO date only
      price: p.price,
    }));

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
      priceHistory,
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
