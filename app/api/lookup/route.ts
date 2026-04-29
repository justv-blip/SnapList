// POST /api/lookup
// Body: JSON { game, name, setCode?, collectorNumber? }
// Used when the user types a card name manually or edits a scanned card.

import { NextRequest, NextResponse } from "next/server";
import { lookupCard } from "@/lib/tcgApis";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString, isValidGame, MAX_PAYLOAD } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Auth check — lookups don't cost scan credits but require login
  try {
    await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  // Enforce payload size limit
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

  // Validate & sanitize inputs
  const game = body?.game;
  if (!isValidGame(game)) {
    return NextResponse.json({ error: "Invalid or missing `game`" }, { status: 400 });
  }

  const name = sanitizeString(body?.name, 200);
  if (!name) {
    return NextResponse.json({ error: "Missing `name`" }, { status: 400 });
  }

  const setCode = sanitizeString(body?.setCode, 20) || undefined;
  const collectorNumber = sanitizeString(body?.collectorNumber, 20) || undefined;

  const hit = await lookupCard({ game, name, setCode, collectorNumber });

  if (!hit) {
    return NextResponse.json({
      found: false,
      match: null,
      note: "No match found. You can still list it — enter the details manually."
    });
  }

  return NextResponse.json({ found: true, match: hit });
}
