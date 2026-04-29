// Mock catalog fallback — DEPRECATED in favor of real APIs.
//
// This file is kept only as a legacy import target. The main lookup pipeline
// in tcgApis.ts now routes through dedicated APIs (Scryfall, PokemonTCG,
// YGOPRODeck, OPTCG, DigimonCard.io, Lorcast) and JustTCG for pricing.
// If all APIs fail, tcgApis.ts returns a default shell directly.
//
// This export is preserved so any existing code that imports mockCatalogLookup
// won't break, but it simply returns a default shell now.

import type { Game, ScannedCard } from "./types";

type Hit = Partial<ScannedCard> & { name: string; game: Game };

export function mockCatalogLookup(input: {
  game: Game;
  name: string;
  setCode?: string;
}): Hit | null {
  // All real lookups are now handled by tcgApis.ts.
  // Return a usable shell so the user can still list the card.
  return {
    name: input.name,
    game: input.game,
    setName: undefined,
    setCode: input.setCode,
    rarity: undefined,
    marketPriceUsd: undefined
  };
}
