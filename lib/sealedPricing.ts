// Sealed product market price lookup via eBay Finding API.
//
// Uses the eBay Finding API (findCompletedItems + soldItemsOnly) with
// application-level credentials — no user OAuth required.
// Returns the median sold price from the last 20 completed listings.
//
// Falls back gracefully: if eBay is unavailable or no credentials are set,
// returns undefined so the UI can prompt the user to enter a price manually.

const FINDING_API =
  "https://svcs.ebay.com/services/search/FindingService/v1";

// eBay category IDs for sealed TCG products
// 183454 = Sealed Trading Card Packs  |  183050 = Trading Cards (parent)
const SEALED_CATEGORY_ID = "183454";

export interface SealedPriceResult {
  marketPriceUsd: number;
  sampleSize: number;
  priceSource: string;
}

/**
 * Look up recent sold prices for a sealed product on eBay.
 * Returns the median sold price from the last 20 matching completed listings.
 */
export async function getSealedProductPrice(
  productName: string,
  game: string | null
): Promise<SealedPriceResult | null> {
  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId) return null;

  // Build a tight search query: product name + game name (if not already in name)
  const gameLabel = gameToLabel(game);
  const queryParts = [productName];
  if (gameLabel && !productName.toLowerCase().includes(gameLabel.toLowerCase())) {
    queryParts.unshift(gameLabel);
  }
  const keywords = queryParts.join(" ");

  const params = new URLSearchParams({
    "OPERATION-NAME":                    "findCompletedItems",
    "SERVICE-VERSION":                   "1.0.0",
    "SECURITY-APPNAME":                  appId,
    "RESPONSE-DATA-FORMAT":              "JSON",
    "REST-PAYLOAD":                      "",
    keywords,
    "categoryId":                        SEALED_CATEGORY_ID,
    "itemFilter(0).name":                "SoldItemsOnly",
    "itemFilter(0).value":               "true",
    "itemFilter(1).name":                "Condition",
    "itemFilter(1).value":               "1000", // New/Sealed
    "sortOrder":                         "EndTimeSoonest",
    "paginationInput.entriesPerPage":    "20",
    "outputSelector(0)":                 "SellerInfo",
  });

  try {
    const res = await fetch(`${FINDING_API}?${params.toString()}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const items: unknown[] =
      data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];

    if (items.length === 0) {
      // Retry with a broader search (just product name, no category filter)
      return broadSearch(keywords, appId);
    }

    const prices = items
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        const sellingStatus = (i.sellingStatus as Record<string, unknown>[])?.[0];
        const currentPrice = sellingStatus?.currentPrice as Record<string, unknown>[] | undefined;
        const price = currentPrice?.[0];
        return price ? parseFloat((price as Record<string, unknown>).__value__ as string) : null;
      })
      .filter((p): p is number => p !== null && p > 0);

    if (prices.length === 0) return null;

    return {
      marketPriceUsd: median(prices),
      sampleSize: prices.length,
      priceSource: "eBay sold listings",
    };
  } catch {
    return null;
  }
}

/** Broader fallback — no category filter, just keyword search */
async function broadSearch(keywords: string, appId: string): Promise<SealedPriceResult | null> {
  const params = new URLSearchParams({
    "OPERATION-NAME":                 "findCompletedItems",
    "SERVICE-VERSION":                "1.0.0",
    "SECURITY-APPNAME":               appId,
    "RESPONSE-DATA-FORMAT":           "JSON",
    "REST-PAYLOAD":                   "",
    keywords:                         `${keywords} sealed`,
    "itemFilter(0).name":             "SoldItemsOnly",
    "itemFilter(0).value":            "true",
    "itemFilter(1).name":             "Condition",
    "itemFilter(1).value":            "1000",
    "sortOrder":                      "EndTimeSoonest",
    "paginationInput.entriesPerPage": "15",
  });

  try {
    const res = await fetch(`${FINDING_API}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const items: unknown[] =
      data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];

    const prices = items
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        const sellingStatus = (i.sellingStatus as Record<string, unknown>[])?.[0];
        const currentPrice = sellingStatus?.currentPrice as Record<string, unknown>[] | undefined;
        const price = currentPrice?.[0];
        return price ? parseFloat((price as Record<string, unknown>).__value__ as string) : null;
      })
      .filter((p): p is number => p !== null && p > 0);

    if (prices.length === 0) return null;

    return {
      marketPriceUsd: median(prices),
      sampleSize: prices.length,
      priceSource: "eBay sold listings (broad)",
    };
  } catch {
    return null;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

function gameToLabel(game: string | null): string {
  const map: Record<string, string> = {
    pokemon: "Pokemon",
    mtg: "Magic the Gathering",
    yugioh: "Yu-Gi-Oh",
    onepiece: "One Piece",
    digimon: "Digimon",
    lorcana: "Lorcana",
    dragonball: "Dragon Ball",
    fleshandblood: "Flesh and Blood",
    weissschwarz: "Weiss Schwarz",
    finalfantasy: "Final Fantasy",
    gundam: "Gundam",
    vanguard: "Vanguard",
    unionarena: "Union Arena",
    battlespirits: "Battle Spirits",
    riftbound: "Riftbound",
    sports: "",
    other: "",
  };
  return game ? (map[game] ?? "") : "";
}
