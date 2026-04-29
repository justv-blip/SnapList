// POST /api/onboarding/complete
// Marks the current user's has_onboarded flag as true.
// Called once from the /welcome page when the user clicks "Start scanning".

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ has_onboarded: true, updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);

  if (error) {
    logger.error("failed to mark onboarding complete", { userId: auth.user.id, error: error.message });
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  logger.info("onboarding complete", { userId: auth.user.id });
  return NextResponse.json({ ok: true });
}
