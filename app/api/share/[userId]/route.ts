import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GAME_LABELS } from "@/lib/types";
import type { Game, ScannedCard } from "@/lib/types";

export const runtime = "nodejs";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  if (!userId || userId.length < 10) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 });
  }

  const admin = getAdminClient();

  // Fetch profile
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Fetch all batches
  const { data: batches } = await admin
    .from("batches")
    .select("cards")
    .eq("user_id", userId);

  const allCards: ScannedCard[] = (batches ?? []).flatMap(
    (b: { cards: ScannedCard[] }) => b.cards ?? []
  );

  const totalCards = allCards.reduce((s, c) => s + (c.quantity || 1), 0);
  const totalValue = allCards.reduce(
    (s, c) => s + (c.marketPriceUsd ?? 0) * (c.quantity || 1),
    0
  );

  // Game breakdown
  const gameMap = new Map<string, { count: number; value: number }>();
  for (const c of allCards) {
    const e = gameMap.get(c.game) ?? { count: 0, value: 0 };
    e.count += c.quantity || 1;
    e.value += (c.marketPriceUsd ?? 0) * (c.quantity || 1);
    gameMap.set(c.game, e);
  }
  const gameBreakdown = Array.from(gameMap.entries())
    .map(([game, d]) => ({
      game: GAME_LABELS[game as Game] ?? game,
      count: d.count,
      value: d.value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Top 5 cards by value
  const topCards = [...allCards]
    .sort((a, b) => (b.marketPriceUsd ?? 0) - (a.marketPriceUsd ?? 0))
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      game: GAME_LABELS[c.game as Game] ?? c.game,
      setName: c.setName ?? null,
      condition: c.condition,
      value: c.marketPriceUsd ?? 0,
      foil: c.foil ?? false,
      slabbed: c.slabbed ?? false,
      imageUrl: c.imageUrl ?? null,
    }));

  const memberSince = new Date(profile.created_at).getFullYear();

  return NextResponse.json({
    displayName: profile.display_name || "SnapList Collector",
    memberSince,
    totalCards,
    totalValue,
    gameBreakdown,
    topCards,
  });
}
