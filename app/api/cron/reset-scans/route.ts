// GET /api/cron/reset-scans
// Called by Vercel Cron on the 1st of every month at 00:05 UTC.
// Calculates unused scans from the previous billing period and stores
// the rollover balance for each paid user in profiles.rollover_scans.
//
// Protected by CRON_SECRET — Vercel passes it automatically as the
// Authorization: Bearer header when the cron fires.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Vercel Cron jobs always use GET.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Reject any call that doesn't carry the expected secret.
  // Vercel injects this automatically; manual callers must supply it.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      logger.warn("cron/reset-scans: unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  logger.info("cron/reset-scans: running calculate_monthly_rollover");

  const { error } = await supabase.rpc("calculate_monthly_rollover");

  if (error) {
    logger.error("cron/reset-scans: rollover calculation failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logger.info("cron/reset-scans: rollover calculation complete");
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString() });
}
