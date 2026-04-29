// GET /api/health
// Returns 200 { status: "ok" } when the app and Supabase are reachable.
// Returns 503 { status: "degraded" } when the DB check fails.
// Used by uptime monitors, load balancers, and deployment readiness checks.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbStatus: "ok" | "error" = "ok";

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) {
      dbStatus = "error";
      logger.warn("health check: db error", { error: error.message });
    }
  } catch (err: any) {
    dbStatus = "error";
    logger.warn("health check: db unreachable", { message: err?.message });
  }

  const latencyMs = Date.now() - start;
  const overall = dbStatus === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      status: overall,
      db: dbStatus,
      latencyMs,
      ts: new Date().toISOString(),
    },
    { status: overall === "ok" ? 200 : 503 }
  );
}
