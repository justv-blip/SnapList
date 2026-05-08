// GET /api/graded-price?company=psa&grade=10&name=Charizard+Holo&set=Base+Set
// Returns the graded market price from eBay sold comps.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { getGradedCardPrice } from "@/lib/gradedPricing";
import { isValidGradingCompany } from "@/lib/validation";
import type { GradingCompany } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const grade   = searchParams.get("grade");
  const name    = searchParams.get("name");
  const set     = searchParams.get("set") ?? undefined;

  if (!company || !isValidGradingCompany(company)) {
    return NextResponse.json({ error: "Invalid grading company" }, { status: 400 });
  }
  if (!grade) {
    return NextResponse.json({ error: "grade is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await getGradedCardPrice(company as GradingCompany, grade, name, set);

  if (!result) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({ found: true, ...result });
}
