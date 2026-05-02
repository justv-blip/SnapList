// TCG API integrations for card lookup and pricing.
//
// Architecture:
//   1. Game-specific APIs for rich card data (images, set info, text):
//      - Scryfall       (MTG)       https://scryfall.com/docs/api
//      - PokemonTCG     (Pokemon)   https://docs.pokemontcg.io/
//      - YGOPRODeck     (Yu-Gi-Oh)  https://ygoprodeck.com/api-guide/
//      - OPTCG API      (One Piece) https://optcgapi.com/documentation
//      - DigimonCard.io (Digimon)   https://digimoncard.io/api-documentation
//      - Lorcast        (Lorcana)   https://lorcast.com/docs/api
//
//   2. JustTCG as a universal pricing layer across 13+ TCGs:
//      https://justtcg.com/docs
//
//   3. Mock catalog as a last-resort fallback for unknown TCGs.

import type { Game, ScannedCard } from "./types";

type LookupHit = Partial<ScannedCard> & { name: string; game: Game };

interface LookupInput {
  game: Game;
  name: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
}

// ============================================================
//  Main entry point
// ============================================================

export async function lookupCard(input: LookupInput): Promise<LookupHit | null> {
  const { game } = input;
  try {
    // Step 1: Try game-specific API for rich card data
    const dedicatedHit = await lookupDedicatedApi(input);

    // Step 2: If we got a hit, try to enrich with JustTCG pricing
    if (dedicatedHit) {
      return await enrichWithJustTcg(dedicatedHit);
    }

    // Step 3: If no dedicated API or miss, try JustTCG directly (covers 13+ games)
    const justTcgHit = await lookupJustTcg(input);
    if (justTcgHit) return justTcgHit;

    // Step 4: Return a default shell so the user can still list the card
    return defaultShell(game, input.name);
  } catch (err) {
    console.error(`[lookupCard] ${game} lookup failed:`, err);
    // On error, try JustTCG as fallback, then default shell
    try {
      const fallback = await lookupJustTcg(input);
      if (fallback) return fallback;
    } catch { /* swallow */ }
    return defaultShell(game, input.name);
  }
}

// Routes to the right game-specific API
async function lookupDedicatedApi(input: LookupInput): Promise<LookupHit | null> {
  switch (input.game) {
    case "mtg":       return lookupScryfall(input);
    case "pokemon":   return lookupPokemon(input);
    case "yugioh":    return lookupYugioh(input);
    case "onepiece":  return lookupOnePiece(input);
    case "digimon":   return lookupDigimon(input);
    case "lorcana":   return lookupLorcana(input);
    default:          return null; // No dedicated API; will fall through to JustTCG
  }
}

// ============================================================
//  JustTCG — Universal pricing for 13+ TCGs
//  https://justtcg.com/docs
// ============================================================

// Maps our Game type to JustTCG's game slug
const JUSTTCG_GAME_MAP: Partial<Record<Game, string>> = {
  pokemon:        "pokemon",
  mtg:            "magic-the-gathering",
  yugioh:         "yugioh",
  onepiece:       "one-piece",
  gundam:         "gundam",
  digimon:        "digimon",
  lorcana:        "lorcana",
  dragonball:     "dragon-ball-super",
  fleshandblood:  "flesh-and-blood",
  unionarena:     "union-arena",
  sports:         "sports",
  weissschwarz:   "weiss-schwarz",
  finalfantasy:   "final-fantasy",
  battlespirits:  "battle-spirits-saga",
  riftbound:      "riftbound",
};

function isJustTcgEnabled(): boolean {
  return !!process.env.JUSTTCG_API_KEY;
}

async function lookupJustTcg(input: LookupInput): Promise<LookupHit | null> {
  if (!isJustTcgEnabled()) return null;

  const gameSlug = JUSTTCG_GAME_MAP[input.game];
  if (!gameSlug) return null;

  const params = new URLSearchParams();
  params.set("game", gameSlug);
  params.set("limit", "8");

  // Sports cards: build a richer query using set name (brand + product line)
  // e.g. "Patrick Mahomes Topps Chrome" is far more precise than just "Patrick Mahomes"
  if (input.game === "sports" && input.setName) {
    params.set("q", `${input.name} ${input.setName}`);
  } else {
    params.set("q", input.name);
  }

  if (input.collectorNumber) params.set("number", input.collectorNumber);
  if (input.setCode) params.set("set", input.setCode);

  const url = `https://api.justtcg.com/functions/v1/cards?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-api-key": process.env.JUSTTCG_API_KEY! },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err: any) {
    console.warn("[justtcg] fetch error", err?.message);
    return null;
  }
  if (!res.ok) {
    console.warn("[justtcg] non-ok status", res.status, "for query:", params.get("q"));
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.warn("[justtcg] invalid JSON response");
    return null;
  }

  // JustTCG wraps results under `data`, `results`, or returns a bare array.
  // Log the shape on the first call to help catch API format changes.
  const cards = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : Array.isArray((data as any)?.results)
        ? (data as any).results
        : null;

  if (!cards || cards.length === 0) {
    // Sports fallback: retry with name only if the enriched query returned nothing
    if (input.game === "sports" && input.setName) {
      const fallbackParams = new URLSearchParams();
      fallbackParams.set("q", input.name);
      fallbackParams.set("game", gameSlug);
      fallbackParams.set("limit", "5");
      const fallbackUrl = `https://api.justtcg.com/functions/v1/cards?${fallbackParams.toString()}`;
      try {
        const res2 = await fetch(fallbackUrl, {
          headers: { "x-api-key": process.env.JUSTTCG_API_KEY! },
          signal: AbortSignal.timeout(10000),
        });
        if (!res2.ok) return null;
        const data2 = await res2.json();
        const cards2 = Array.isArray(data2)
          ? data2
          : Array.isArray((data2 as any)?.data)
            ? (data2 as any).data
            : Array.isArray((data2 as any)?.results)
              ? (data2 as any).results
              : null;
        if (!cards2 || cards2.length === 0) return null;
        return justTcgToHit(cards2[0], input.game);
      } catch {
        return null;
      }
    }
    return null;
  }

  // Pick best match — for sports prefer collector number match, then exact name match
  const needle = input.name.trim().toLowerCase();
  const card =
    (input.collectorNumber && cards.find((c: any) => c.number === input.collectorNumber)) ||
    cards.find((c: any) => c.name?.toLowerCase() === needle) ||
    cards[0];

  return justTcgToHit(card, input.game);
}

function justTcgToHit(card: any, game: Game): LookupHit {
  // JustTCG returns pricing in a variants array or at the top level
  const variant = card?.variants?.[0];
  const price =
    variant?.market_price ??
    variant?.price ??
    card?.market_price ??
    card?.price;

  return {
    name: card.name || "Unknown",
    game,
    setName: card.set_name || card.set || undefined,
    setCode: card.set_code || undefined,
    collectorNumber: card.number || card.collector_number || undefined,
    rarity: card.rarity || variant?.rarity || undefined,
    imageUrl: card.image_url || card.image || undefined,
    marketPriceUsd: typeof price === "number" ? price : price ? Number(price) : undefined,
    externalUrl: card.url || card.product_url || undefined,
  };
}

// Enrich an existing hit with JustTCG pricing if available
async function enrichWithJustTcg(hit: LookupHit): Promise<LookupHit> {
  if (!isJustTcgEnabled()) return hit;
  // If we already have a price, skip
  if (hit.marketPriceUsd != null && hit.marketPriceUsd > 0) return hit;

  try {
    const pricingHit = await lookupJustTcg({
      game: hit.game,
      name: hit.name,
      setName: hit.setName,
      setCode: hit.setCode,
      collectorNumber: hit.collectorNumber,
    });
    if (pricingHit?.marketPriceUsd != null) {
      hit.marketPriceUsd = pricingHit.marketPriceUsd;
    }
  } catch { /* pricing enrichment is best-effort */ }
  return hit;
}

// ============================================================
//  Magic: The Gathering (Scryfall)
// ============================================================

async function lookupScryfall(input: LookupInput): Promise<LookupHit | null> {
  const { name, setCode, collectorNumber } = input;
  // If we have set + number, prefer the exact endpoint.
  if (setCode && collectorNumber) {
    const url = `https://api.scryfall.com/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(collectorNumber)}`;
    const res = await fetch(url);
    if (res.ok) return scryfallToHit(await res.json());
  }
  // Fallback: named fuzzy search.
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return scryfallToHit(await res.json());
}

function scryfallToHit(card: any): LookupHit {
  const usd = card?.prices?.usd ? Number(card.prices.usd) : undefined;
  const image =
    card?.image_uris?.normal ||
    card?.image_uris?.large ||
    card?.card_faces?.[0]?.image_uris?.normal;
  return {
    name: card.name,
    game: "mtg",
    setName: card.set_name,
    setCode: card.set?.toUpperCase(),
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    imageUrl: image,
    marketPriceUsd: usd,
    externalUrl: card.scryfall_uri
  };
}

// ============================================================
//  Pokémon (pokemontcg.io)
// ============================================================

async function lookupPokemon(input: LookupInput): Promise<LookupHit | null> {
  const { name, setCode, collectorNumber } = input;
  const key = process.env.POKEMON_TCG_API_KEY;
  const headers: HeadersInit = key ? { "X-Api-Key": key } : {};

  // Build query — wrap the OR clause in parentheses so it doesn't break the AND chain
  const parts: string[] = [`name:"${name}"`];
  if (setCode) parts.push(`(set.ptcgoCode:${setCode} OR set.id:${setCode.toLowerCase()})`);
  if (collectorNumber) parts.push(`number:${collectorNumber}`);
  const q = parts.join(" ");

  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // If strict query fails, try a looser name-only search
    const fallbackUrl = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:"${name}"`)}&pageSize=5&orderBy=-set.releaseDate`;
    const res2 = await fetch(fallbackUrl, { headers });
    if (!res2.ok) return null;
    const data2 = await res2.json();
    const card2 = data2?.data?.[0];
    if (!card2) return null;
    return pokemonToHit(card2);
  }
  const data = await res.json();
  const card = data?.data?.[0];
  if (!card) {
    // Try name-only if the full query returned nothing
    const fallbackUrl = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:"${name}"`)}&pageSize=5&orderBy=-set.releaseDate`;
    const res2 = await fetch(fallbackUrl, { headers });
    if (!res2.ok) return null;
    const data2 = await res2.json();
    return data2?.data?.[0] ? pokemonToHit(data2.data[0]) : null;
  }
  return pokemonToHit(card);
}

function extractPokemonPrice(card: any): number | undefined {
  // Check all price categories — market first, then mid, then low
  const priceGroups = card?.tcgplayer?.prices || {};
  for (const group of Object.values(priceGroups) as any[]) {
    if (group?.market != null) return group.market;
  }
  for (const group of Object.values(priceGroups) as any[]) {
    if (group?.mid != null) return group.mid;
  }
  for (const group of Object.values(priceGroups) as any[]) {
    if (group?.low != null) return group.low;
  }
  // Cardmarket as last resort
  const cm = card?.cardmarket?.prices;
  return cm?.averageSellPrice ?? cm?.avg1 ?? cm?.avg7 ?? cm?.avg30 ?? undefined;
}

function pokemonToHit(card: any): LookupHit {
  const price = extractPokemonPrice(card);
  return {
    name: card.name,
    game: "pokemon",
    setName: card.set?.name,
    setCode: card.set?.ptcgoCode || card.set?.id?.toUpperCase(),
    collectorNumber: card.number,
    rarity: card.rarity,
    imageUrl: card?.images?.large || card?.images?.small,
    marketPriceUsd: typeof price === "number" ? price : undefined,
    externalUrl: card?.tcgplayer?.url
  };
}

// ============================================================
//  Yu-Gi-Oh (YGOPRODeck)
// ============================================================

async function lookupYugioh(input: LookupInput): Promise<LookupHit | null> {
  const { name } = input;
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) {
    // Try fuzzy
    const fuzzy = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name)}&num=1&offset=0`;
    const res2 = await fetch(fuzzy);
    if (!res2.ok) return null;
    const data2 = await res2.json();
    return ygoToHit(data2?.data?.[0]);
  }
  const data = await res.json();
  return ygoToHit(data?.data?.[0]);
}

function ygoToHit(card: any): LookupHit | null {
  if (!card) return null;
  const firstSet = card?.card_sets?.[0];
  const price =
    card?.card_prices?.[0]?.tcgplayer_price ??
    card?.card_prices?.[0]?.cardmarket_price;
  return {
    name: card.name,
    game: "yugioh",
    setName: firstSet?.set_name,
    setCode: firstSet?.set_code,
    collectorNumber: firstSet?.set_code,
    rarity: firstSet?.set_rarity,
    imageUrl: card?.card_images?.[0]?.image_url,
    marketPriceUsd: price ? Number(price) : undefined,
    externalUrl: `https://ygoprodeck.com/card/?search=${encodeURIComponent(card.name)}`
  };
}

// ============================================================
//  One Piece (OPTCG API) — https://optcgapi.com/documentation
//  Free, no auth, rate limit: 15 req / 10s
// ============================================================

async function lookupOnePiece(input: LookupInput): Promise<LookupHit | null> {
  const { name, setCode, collectorNumber } = input;

  // If we have a collector number like "OP01-001", try direct card lookup
  if (collectorNumber) {
    const directUrl = `https://optcgapi.com/api/cards/${encodeURIComponent(collectorNumber)}`;
    try {
      const res = await fetch(directUrl);
      if (res.ok) {
        const card = await res.json();
        if (card && card.name) return optcgToHit(card);
      }
    } catch { /* fall through to search */ }
  }

  // Search by name
  const searchUrl = `https://optcgapi.com/api/cards?name=${encodeURIComponent(name)}`;
  const res = await fetch(searchUrl);
  if (!res.ok) return null;

  const data = await res.json();
  const cards = Array.isArray(data) ? data : data?.data || data?.cards || [];
  if (cards.length === 0) return null;

  // Prefer exact name match
  const needle = name.trim().toLowerCase();
  const match = cards.find((c: any) =>
    c.name?.toLowerCase() === needle
  ) || cards[0];

  return optcgToHit(match);
}

function optcgToHit(card: any): LookupHit {
  return {
    name: card.name,
    game: "onepiece",
    setName: card.set_name || card.set || undefined,
    setCode: card.set_code || card.setCode || undefined,
    collectorNumber: card.card_number || card.number || card.id || undefined,
    rarity: card.rarity || undefined,
    imageUrl: card.image_url || card.image || card.images?.large || undefined,
    marketPriceUsd: undefined, // OPTCG API doesn't include pricing; JustTCG handles that
    externalUrl: card.url || (card.id ? `https://optcgapi.com/cards/${card.id}` : undefined),
  };
}

// ============================================================
//  Digimon (digimoncard.io) — https://digimoncard.io/api-documentation
//  Free, no auth, rate limit: 15 req / 10s
// ============================================================

async function lookupDigimon(input: LookupInput): Promise<LookupHit | null> {
  const { name, collectorNumber } = input;

  // If we have a card number like "BT1-001", try it
  if (collectorNumber) {
    const url = `https://digimoncard.io/api-public/search.php?card=${encodeURIComponent(collectorNumber)}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const cards = Array.isArray(data) ? data : [];
        if (cards.length > 0) return digimonToHit(cards[0]);
      }
    } catch { /* fall through to name search */ }
  }

  // Search by name
  const url = `https://digimoncard.io/api-public/search.php?n=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const cards = Array.isArray(data) ? data : [];
  if (cards.length === 0) return null;

  // Prefer exact name match
  const needle = name.trim().toLowerCase();
  const match = cards.find((c: any) =>
    c.name?.toLowerCase() === needle
  ) || cards[0];

  return digimonToHit(match);
}

function digimonToHit(card: any): LookupHit {
  return {
    name: card.name,
    game: "digimon",
    setName: card.set_name || card.pack_name || undefined,
    setCode: undefined, // Digimon uses card_number which includes set prefix (e.g. BT1-001)
    collectorNumber: card.cardnumber || card.card_number || undefined,
    rarity: card.rarity || undefined,
    imageUrl: card.image_url || (card.cardnumber ? `https://images.digimoncard.io/images/cards/${card.cardnumber}.jpg` : undefined),
    marketPriceUsd: undefined, // JustTCG handles pricing
    externalUrl: card.cardnumber ? `https://digimoncard.io/card/${card.cardnumber}` : undefined,
  };
}

// ============================================================
//  Disney Lorcana (Lorcast) — https://lorcast.com/docs/api
//  Free, no auth
// ============================================================

async function lookupLorcana(input: LookupInput): Promise<LookupHit | null> {
  const { name, setCode, collectorNumber } = input;

  // If we have set + number, try the exact endpoint
  if (setCode && collectorNumber) {
    const url = `https://api.lorcast.com/v0/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(collectorNumber)}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const card = await res.json();
        if (card && card.name) return lorcastToHit(card);
      }
    } catch { /* fall through to search */ }
  }

  // Search by name
  const url = `https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const cards = data?.results || (Array.isArray(data) ? data : []);
  if (cards.length === 0) return null;

  // Prefer exact name match
  const needle = name.trim().toLowerCase();
  const match = cards.find((c: any) =>
    c.name?.toLowerCase() === needle ||
    c.full_name?.toLowerCase() === needle
  ) || cards[0];

  return lorcastToHit(match);
}

function lorcastToHit(card: any): LookupHit {
  const image =
    card?.image_uris?.digital?.normal ||
    card?.image_uris?.digital?.large ||
    card?.image_uris?.normal ||
    card?.image;
  return {
    name: card.full_name || card.name,
    game: "lorcana",
    setName: card.set?.name || card.set_name || undefined,
    setCode: card.set?.code || card.set_code || undefined,
    collectorNumber: card.collector_number || card.number || undefined,
    rarity: card.rarity || undefined,
    imageUrl: image || undefined,
    marketPriceUsd: undefined, // JustTCG handles pricing
    externalUrl: card.url || (card.id ? `https://lorcast.com/cards/${card.id}` : undefined),
  };
}

// ============================================================
//  Default shell — when no API returns a match
// ============================================================

function defaultShell(game: Game, name: string): LookupHit {
  return {
    name,
    game,
    setName: undefined,
    setCode: undefined,
    rarity: undefined,
    marketPriceUsd: undefined,
  };
}
