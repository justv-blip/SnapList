// POST /api/export
// Body: JSON { cards: ScannedCard[], format: "ebay" | "tcgplayer" | "json" | "csv", templates?: ListingTemplate[] }
// Returns the exported file as a downloadable response.

import { NextRequest, NextResponse } from "next/server";
import { exportCards, ExportFormat } from "@/lib/exporters";
import type { ListingTemplate, ScannedCard } from "@/lib/types";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import {
  isValidExportFormat,
  sanitizeCardForExport,
  MAX_PAYLOAD,
} from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // ── Auth check (was missing!) ──
  try {
    await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  // Enforce payload size limit
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_PAYLOAD.export) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  // Validate format
  const format = body?.format;
  if (!isValidExportFormat(format)) {
    return NextResponse.json(
      { error: "Invalid format. Must be one of: ebay, tcgplayer, whatnot, shopify, squarespace, json, csv" },
      { status: 400 }
    );
  }

  // Validate & sanitize cards
  if (!Array.isArray(body?.cards) || body.cards.length === 0) {
    return NextResponse.json({ error: "No cards to export" }, { status: 400 });
  }
  if (body.cards.length > MAX_PAYLOAD.exportCards) {
    return NextResponse.json(
      { error: `Too many cards. Maximum ${MAX_PAYLOAD.exportCards} per export.` },
      { status: 400 }
    );
  }

  const cards = body.cards
    .map((c: Record<string, unknown>) => sanitizeCardForExport(c))
    .filter(Boolean) as ScannedCard[];

  if (cards.length === 0) {
    return NextResponse.json({ error: "No valid cards to export" }, { status: 400 });
  }

  const templates = body?.templates as ListingTemplate[] | undefined;

  const result = exportCards(cards, format, templates);
  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Content-Type": `${result.mimeType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
