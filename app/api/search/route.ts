// POST /api/search
// Body: JSON { game, query, setCode? }
// Returns: { results: SearchResult[] }
//
// Unlike /api/lookup (which returns a single best match), this endpoint
// returns multiple candidates so the user can pick the correct one.
// Used by the CardVerification panel when AI identification is wrong.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString, isValidGame, MAX_PAYLOAD } from "@/lib/validation";
import { searchCards, type SearchResult } from "@/lib/tcgSearch";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_PAYLOAD.lookup) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const game = body?.game;
  if (!isValidGame(game)) {
    return NextResponse.json({ error: "Invalid or missing `game`" }, { status: 400 });
  }

  const query = sanitizeString(body?.query, 200);
  if (!query) {
    return NextResponse.json({ error: "Missing `query`" }, { status: 400 });
  }

  const setCode = sanitizeString(body?.setCode, 20) || undefined;

  try {
    const results = await searchCards({ game, query, setCode });
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/search]", err);
    return NextResponse.json({ results: [] });
  }
}
