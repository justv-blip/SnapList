// Multi-result card search with variant/finish support.
//
// Unlike tcgApis.ts (which returns a single best match), this module returns
// MULTIPLE candidates so the user can pick the correct card + variant in
// the CardVerification panel.
//
// Each result includes variant pricing (Normal, Reverse Holo, Holofoil, etc.)
// pulled from the game-specific API responses.

import type { Game, CardFinish, VariantPrice } from "./types";

// Re-export VariantPrice from types so callers can import from either place
export type { VariantPrice };

export interface SearchResult {
  id: string;              // API-specific unique ID (Scryfall UUID, pokemontcg ID, etc.)
  name: string;
  game: Game;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  rarity?: string;
  imageUrl?: string;
  externalUrl?: string;
  variants: VariantPrice[];
  // Best price across variants for quick display
  marketPriceUsd?: number;
}

interface SearchInput {
  game: Game;
  query: string;
  setCode?: string;
}

// ---- Main entry ----

export async function searchCards(input: SearchInput): Promise<SearchResult[]> {
  const { game, query, setCode } = input;

  switch (game) {
    case "pokemon":   return searchPokemon(query, setCode);
    case "mtg":       return searchScryfall(query, setCode);
    case "yugioh":    return searchYugioh(query);
    case "onepiece":  return searchOnePiece(query);
    case "digimon":   return searchDigimon(query);
    case "lorcana":   return searchLorcana(query);
    default:          return searchJustTcg(game, query);
  }
}

// ---- Pokemon (pokemontcg.io) ----
// The Pokemon API returns tcgplayer.prices with variant groups:
//   normal, reverseHolofoil, holofoil, 1stEditionNormal, 1stEditionHolofoil

async function searchPokemon(query: string, setCode?: string): Promise<SearchResult[]> {
  const key = process.env.POKEMON_TCG_API_KEY;
  const headers: HeadersInit = key ? { "X-Api-Key": key } : {};

  const parts: string[] = [`name:"${query}"`];
  if (setCode) parts.push(`(set.ptcgoCode:${setCode} OR set.id:${setCode.toLowerCase()})`);
  const q = parts.join(" ");

  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=10&orderBy=-set.releaseDate`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // Fallback: name-only
    const fallback = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:"${query}"`)}&pageSize=10&orderBy=-set.releaseDate`;
    const res2 = await fetch(fallback, { headers });
    if (!res2.ok) return [];
    const data2 = await res2.json();
    return (data2?.data || []).map(pokemonCardToResult);
  }

  const data = await res.json();
  const cards = data?.data || [];

  // If strict query got nothing, try name-only
  if (cards.length === 0) {
    const fallback = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:"${query}"`)}&pageSize=10&orderBy=-set.releaseDate`;
    const res2 = await fetch(fallback, { headers });
    if (!res2.ok) return [];
    const data2 = await res2.json();
    return (data2?.data || []).map(pokemonCardToResult);
  }

  return cards.map(pokemonCardToResult);
}

const POKEMON_VARIANT_MAP: Record<string, { finish: CardFinish; label: string }> = {
  normal:                { finish: "non-holo",     label: "Normal" },
  reverseHolofoil:       { finish: "reverse-holo", label: "Reverse Holo" },
  holofoil:              { finish: "holo",         label: "Holofoil" },
  "1stEditionNormal":    { finish: "non-holo",     label: "1st Edition Normal" },
  "1stEditionHolofoil":  { finish: "holo",         label: "1st Edition Holo" },
};

function pokemonCardToResult(card: any): SearchResult {
  const priceGroups = card?.tcgplayer?.prices || {};
  const variants: VariantPrice[] = [];

  for (const [key, group] of Object.entries(priceGroups)) {
    const mapping = POKEMON_VARIANT_MAP[key];
    const g = group as any;
    if (mapping && g) {
      variants.push({
        finish: mapping.finish,
        label: mapping.label,
        marketPrice: g.market ?? undefined,
        lowPrice: g.low ?? undefined,
        midPrice: g.mid ?? undefined,
      });
    }
  }

  // Best market price across variants
  const bestPrice = variants.reduce<number | undefined>((best, v) => {
    if (v.marketPrice != null && (best == null || v.marketPrice < best)) return v.marketPrice;
    return best;
  }, undefined);

  return {
    id: card.id,
    name: card.name,
    game: "pokemon",
    setName: card.set?.name,
    setCode: card.set?.ptcgoCode || card.set?.id?.toUpperCase(),
    collectorNumber: card.number,
    rarity: card.rarity,
    imageUrl: card?.images?.large || card?.images?.small,
    externalUrl: card?.tcgplayer?.url,
    variants,
    marketPriceUsd: bestPrice,
  };
}

// ---- MTG (Scryfall) ----
// Scryfall search returns multiple prints; finishes are in card.finishes array

async function searchScryfall(query: string, setCode?: string): Promise<SearchResult[]> {
  let q = query;
  if (setCode) q += ` set:${setCode}`;

  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=released&dir=desc&unique=prints`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const cards = data?.data || [];
  return cards.slice(0, 10).map(scryfallCardToResult);
}

function scryfallCardToResult(card: any): SearchResult {
  const variants: VariantPrice[] = [];
  const prices = card.prices || {};

  // Scryfall prices: usd (normal), usd_foil, usd_etched
  if (prices.usd != null) {
    variants.push({
      finish: "non-holo",
      label: "Normal",
      marketPrice: Number(prices.usd),
    });
  }
  if (prices.usd_foil != null) {
    variants.push({
      finish: "holo",
      label: "Foil",
      marketPrice: Number(prices.usd_foil),
    });
  }
  if (prices.usd_etched != null) {
    variants.push({
      finish: "etched",
      label: "Etched Foil",
      marketPrice: Number(prices.usd_etched),
    });
  }

  const image =
    card?.image_uris?.normal ||
    card?.image_uris?.large ||
    card?.card_faces?.[0]?.image_uris?.normal;

  const bestPrice = variants.reduce<number | undefined>((best, v) => {
    if (v.marketPrice != null && (best == null || v.marketPrice < best)) return v.marketPrice;
    return best;
  }, undefined);

  return {
    id: card.id,
    name: card.name,
    game: "mtg",
    setName: card.set_name,
    setCode: card.set?.toUpperCase(),
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    imageUrl: image,
    externalUrl: card.scryfall_uri,
    variants,
    marketPriceUsd: bestPrice,
  };
}

// ---- Yu-Gi-Oh (YGOPRODeck) ----

async function searchYugioh(query: string): Promise<SearchResult[]> {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}&num=10&offset=0`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const cards = data?.data || [];
  return cards.slice(0, 10).map(yugiohCardToResult);
}

function yugiohCardToResult(card: any): SearchResult {
  const variants: VariantPrice[] = [];
  const price = card?.card_prices?.[0];

  if (price?.tcgplayer_price) {
    variants.push({
      finish: "non-holo",
      label: "Standard",
      marketPrice: Number(price.tcgplayer_price) || undefined,
    });
  }

  const firstSet = card?.card_sets?.[0];

  return {
    id: String(card.id),
    name: card.name,
    game: "yugioh",
    setName: firstSet?.set_name,
    setCode: firstSet?.set_code,
    collectorNumber: firstSet?.set_code,
    rarity: firstSet?.set_rarity,
    imageUrl: card?.card_images?.[0]?.image_url,
    externalUrl: `https://ygoprodeck.com/card/?search=${encodeURIComponent(card.name)}`,
    variants,
    marketPriceUsd: variants[0]?.marketPrice,
  };
}

// ---- One Piece (OPTCG API) ----

async function searchOnePiece(query: string): Promise<SearchResult[]> {
  const url = `https://optcgapi.com/api/cards?name=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const cards = Array.isArray(data) ? data : data?.data || data?.cards || [];
  return cards.slice(0, 10).map((card: any) => ({
    id: card.id || card.card_number || crypto.randomUUID(),
    name: card.name,
    game: "onepiece" as Game,
    setName: card.set_name || card.set,
    setCode: card.set_code || card.setCode,
    collectorNumber: card.card_number || card.number || card.id,
    rarity: card.rarity,
    imageUrl: card.image_url || card.image || card.images?.large,
    externalUrl: card.url || (card.id ? `https://optcgapi.com/cards/${card.id}` : undefined),
    variants: [],
    marketPriceUsd: undefined,
  }));
}

// ---- Digimon (digimoncard.io) ----

async function searchDigimon(query: string): Promise<SearchResult[]> {
  const url = `https://digimoncard.io/api-public/search.php?n=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const cards = Array.isArray(data) ? data : [];
  return cards.slice(0, 10).map((card: any) => ({
    id: card.cardnumber || card.card_number || crypto.randomUUID(),
    name: card.name,
    game: "digimon" as Game,
    setName: card.set_name || card.pack_name,
    setCode: undefined,
    collectorNumber: card.cardnumber || card.card_number,
    rarity: card.rarity,
    imageUrl: card.image_url || (card.cardnumber ? `https://images.digimoncard.io/images/cards/${card.cardnumber}.jpg` : undefined),
    externalUrl: card.cardnumber ? `https://digimoncard.io/card/${card.cardnumber}` : undefined,
    variants: [],
    marketPriceUsd: undefined,
  }));
}

// ---- Lorcana (Lorcast) ----

async function searchLorcana(query: string): Promise<SearchResult[]> {
  const url = `https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const cards = data?.results || (Array.isArray(data) ? data : []);
  return cards.slice(0, 10).map((card: any) => {
    const image =
      card?.image_uris?.digital?.normal ||
      card?.image_uris?.digital?.large ||
      card?.image_uris?.normal ||
      card?.image;
    return {
      id: card.id || crypto.randomUUID(),
      name: card.full_name || card.name,
      game: "lorcana" as Game,
      setName: card.set?.name || card.set_name,
      setCode: card.set?.code || card.set_code,
      collectorNumber: card.collector_number || card.number,
      rarity: card.rarity,
      imageUrl: image,
      externalUrl: card.url || (card.id ? `https://lorcast.com/cards/${card.id}` : undefined),
      variants: [],
      marketPriceUsd: undefined,
    };
  });
}

// ---- JustTCG fallback for other games ----

async function searchJustTcg(game: Game, query: string): Promise<SearchResult[]> {
  if (!process.env.JUSTTCG_API_KEY) return [];

  const GAME_MAP: Partial<Record<Game, string>> = {
    pokemon: "pokemon",
    mtg: "magic-the-gathering",
    yugioh: "yugioh",
    onepiece: "one-piece",
    gundam: "gundam",
    digimon: "digimon",
    lorcana: "lorcana",
    dragonball: "dragon-ball-super",
    fleshandblood: "flesh-and-blood",
    unionarena: "union-arena",
    sports: "sports",
    weissschwarz: "weiss-schwarz",
    finalfantasy: "final-fantasy",
    battlespirits: "battle-spirits-saga",
  };

  const gameSlug = GAME_MAP[game];
  if (!gameSlug) return [];

  const params = new URLSearchParams();
  params.set("q", query);
  params.set("game", gameSlug);
  params.set("limit", "10");

  const url = `https://api.justtcg.com/functions/v1/cards?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "x-api-key": process.env.JUSTTCG_API_KEY! },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const cards = data?.data || data?.results || data;
  if (!Array.isArray(cards)) return [];

  return cards.slice(0, 10).map((card: any) => {
    const variants: VariantPrice[] = [];
    const cardVariants = card?.variants || [];

    for (const v of cardVariants) {
      variants.push({
        finish: "non-holo", // JustTCG doesn't always label finishes
        label: v.name || v.variant_name || "Standard",
        marketPrice: v.market_price ?? v.price ?? undefined,
        lowPrice: v.low_price ?? undefined,
        midPrice: v.mid_price ?? undefined,
      });
    }

    // If no variants array, use top-level price
    if (variants.length === 0 && (card.market_price || card.price)) {
      variants.push({
        finish: "non-holo",
        label: "Standard",
        marketPrice: card.market_price ?? card.price ?? undefined,
      });
    }

    return {
      id: card.id || card.product_id || crypto.randomUUID(),
      name: card.name || "Unknown",
      game,
      setName: card.set_name || card.set,
      setCode: card.set_code,
      collectorNumber: card.number || card.collector_number,
      rarity: card.rarity || variants[0]?.label,
      imageUrl: card.image_url || card.image,
      externalUrl: card.url || card.product_url,
      variants,
      marketPriceUsd: variants[0]?.marketPrice,
    };
  });
}
