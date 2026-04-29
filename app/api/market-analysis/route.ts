import { NextRequest, NextResponse } from "next/server";
import { type MarketAnalysis } from "@/lib/marketAnalysis";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString, isValidGame } from "@/lib/validation";

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
    const game = body?.game;
    const setName = sanitizeString(body?.setName, 200) || undefined;

    if (!cardName || !isValidGame(game)) {
      return NextResponse.json(
        { error: "cardName and a valid game are required" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      cardName,
      game,
      setName: setName || undefined,
      currentPrice: 0,
      averagePrice30d: 0,
      averagePrice90d: 0,
      trend7d: "stable",
      trend30d: "stable",
      priceChange7dPercent: 0,
      priceChange30dPercent: 0,
      signal: "hold",
      signalConfidence: 0,
      signalReasoning:
        "Market data is not yet available for this card. Check MyCollectibles.com for detailed price history and trends.",
      priceHistory: [],
      source: "internal",
      lastUpdated: new Date().toISOString(),
    } satisfies MarketAnalysis);
  } catch {
    return NextResponse.json(
      { error: "Failed to analyze market data" },
      { status: 500 }
    );
  }
}
