export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { getPriceTrend, PriceTrend } from "@/lib/priceHistory";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const game = searchParams.get("game") ?? "";
    const name = searchParams.get("name") ?? "";
    const setName = searchParams.get("setName") ?? undefined;

    if (!game || !name) {
      return NextResponse.json(
        { error: "Missing required query params: game, name" },
        { status: 400 }
      );
    }

    const trend: PriceTrend | null = await getPriceTrend(
      auth.supabase,
      auth.user.id,
      game,
      name,
      setName
    );

    return NextResponse.json({ trend });
  } catch (err) {
    return authErrorResponse(err);
  }
}
