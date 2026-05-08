// POST /api/import
// Accepts a JSON array of card rows (parsed client-side from a CSV).
// Creates a new "CSV Import — <date>" batch and inserts all cards.
// Returns the new batch ID and count of cards imported.
//
// Body: { rows: CsvCardRow[], batchName?: string }
//
// CsvCardRow fields (all optional except name):
//   name, game, set_name, set_code, collector_number, rarity,
//   condition, quantity, price, foil, language, notes, sku

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString } from "@/lib/validation";
import { v4 as uuid } from "uuid";
import { GAMES, CONDITIONS } from "@/lib/types";
import type { Game, Condition } from "@/lib/types";

export const runtime = "nodejs";

const VALID_GAMES = new Set<string>(GAMES);
const VALID_CONDITIONS = new Set<string>(CONDITIONS);
const MAX_ROWS = 2000;

// Normalise a game string from various common aliases
function normaliseGame(raw: string): Game {
  const s = raw.toLowerCase().trim();
  const aliases: Record<string, Game> = {
    "pokemon":         "pokemon",
    "pokémon":         "pokemon",
    "poke":            "pokemon",
    "magic":           "mtg",
    "magic the gathering": "mtg",
    "mtg":             "mtg",
    "yugioh":          "yugioh",
    "yu-gi-oh":        "yugioh",
    "ygo":             "yugioh",
    "one piece":       "onepiece",
    "onepiece":        "onepiece",
    "lorcana":         "lorcana",
    "disney lorcana":  "lorcana",
    "digimon":         "digimon",
    "dragonball":      "dragonball",
    "dragon ball":     "dragonball",
    "flesh and blood": "fleshandblood",
    "fab":             "fleshandblood",
    "weiss":           "weissschwarz",
    "weiss schwarz":   "weissschwarz",
    "gundam":          "gundam",
    "vanguard":        "vanguard",
    "sports":          "sports",
  };
  if (aliases[s]) return aliases[s];
  if (VALID_GAMES.has(s)) return s as Game;
  return "other";
}

// Normalise a condition string
function normaliseCondition(raw: string): Condition {
  const s = raw.trim();
  const aliases: Record<string, Condition> = {
    "nm":   "Near Mint",
    "nm/m": "Near Mint",
    "near mint": "Near Mint",
    "lp":   "Lightly Played",
    "sp":   "Lightly Played",
    "lightly played": "Lightly Played",
    "mp":   "Moderately Played",
    "moderately played": "Moderately Played",
    "hp":   "Heavily Played",
    "heavily played": "Heavily Played",
    "dmg":  "Damaged",
    "damaged": "Damaged",
    "d":    "Damaged",
  };
  const lower = s.toLowerCase();
  if (aliases[lower]) return aliases[lower];
  if (VALID_CONDITIONS.has(s)) return s as Condition;
  return "Near Mint";
}

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = body.rows as unknown[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows. Maximum ${MAX_ROWS} per import.` },
      { status: 400 }
    );
  }

  const batchName =
    sanitizeString(body.batchName as string, 100) ||
    `CSV Import — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const batchId = uuid();

  // Create batch
  const { error: batchErr } = await auth.supabase.from("batches").insert({
    id:         batchId,
    user_id:    auth.user.id,
    name:       batchName,
    status:     "ready",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (batchErr) {
    return NextResponse.json({ error: batchErr.message }, { status: 500 });
  }

  // Build card rows
  const cardRows = rows.map((raw: unknown) => {
    const r = raw as Record<string, unknown>;
    const name = sanitizeString(r.name as string || r.Name as string || r["Card Name"] as string, 300);
    if (!name) return null;

    const quantity = Math.max(1, Math.round(Number(
      r.quantity ?? r.Quantity ?? r.qty ?? r.Qty ?? 1
    ) || 1));

    const price = parseFloat(
      String(r.price ?? r.Price ?? r.market_price ?? r["Market Price"] ?? r.value ?? "0")
    ) || 0;

    const foilRaw = String(r.foil ?? r.Foil ?? r.holo ?? r.Holo ?? "").toLowerCase();
    const foil = ["yes", "true", "1", "y", "foil", "holo"].includes(foilRaw);

    return {
      id:                     uuid(),
      batch_id:               batchId,
      user_id:                auth.user.id,
      name,
      game:                   normaliseGame(String(r.game ?? r.Game ?? "other")),
      set_name:               sanitizeString(String(r.set_name ?? r["Set Name"] ?? r.set ?? r.Set ?? ""), 200) || null,
      set_code:               sanitizeString(String(r.set_code ?? r.setCode ?? r["Set Code"] ?? ""), 20) || null,
      collector_number:       sanitizeString(String(r.collector_number ?? r["Collector Number"] ?? r.number ?? r["#"] ?? ""), 30) || null,
      rarity:                 sanitizeString(String(r.rarity ?? r.Rarity ?? ""), 50) || null,
      market_price_usd:       price > 0 ? price : null,
      condition:              normaliseCondition(String(r.condition ?? r.Condition ?? r.grade ?? "")),
      quantity,
      foil,
      language:               sanitizeString(String(r.language ?? r.Language ?? "English"), 50) || "English",
      notes:                  sanitizeString(String(r.notes ?? r.Notes ?? ""), 1000) || null,
      identification_source:  "manual",
      identification_confidence: null,
      sku:                    sanitizeString(String(r.sku ?? r.SKU ?? ""), 100) || null,
      created_at:             new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  if (cardRows.length === 0) {
    // Clean up the empty batch
    await auth.supabase.from("batches").delete().eq("id", batchId);
    return NextResponse.json({ error: "No valid cards found in the import." }, { status: 400 });
  }

  // Insert in chunks of 500 to stay within Supabase limits
  const CHUNK = 500;
  for (let i = 0; i < cardRows.length; i += CHUNK) {
    const { error: cardErr } = await auth.supabase
      .from("cards")
      .insert(cardRows.slice(i, i + CHUNK));
    if (cardErr) {
      return NextResponse.json({ error: cardErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    batchId,
    batchName,
    imported: cardRows.length,
    skipped: rows.length - cardRows.length,
  }, { status: 201 });
}
