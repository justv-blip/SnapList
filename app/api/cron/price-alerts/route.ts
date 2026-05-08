// GET /api/cron/price-alerts
// Called daily by Vercel Cron at 09:00 UTC.
// Checks active wishlist price alerts against eBay sold comps
// and sends Resend email notifications when a price hits the target.
//
// Protected by CRON_SECRET — Vercel passes it automatically.

import { NextRequest, NextResponse } from "next/server";
import { runPriceAlerts } from "@/lib/priceAlerts";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Give the cron up to 5 minutes for large alert lists
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      logger.warn("cron/price-alerts: unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  logger.info("cron/price-alerts: starting run");

  try {
    const result = await runPriceAlerts();
    logger.info("cron/price-alerts: complete", result as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result, ran_at: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    logger.error("cron/price-alerts: failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
