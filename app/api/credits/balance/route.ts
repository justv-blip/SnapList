// GET /api/credits/balance
// Returns the authenticated user's current credit balance.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("credits")
    .eq("id", auth.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ credits: 0 });
  }

  return NextResponse.json({ credits: (data as any).credits ?? 0 });
}
