// Graded card market price lookup via eBay Finding API.
//
// Searches completed sold listings for "[PSA 10] [Card Name]" style queries
// and returns the median sold price as a graded market comp.
//
// No user OAuth required — uses application-level EBAY_CLIENT_ID.

import type { GradingCompany } from "@/lib/types";

const FINDING_API =
  "https://svcs.ebay.com/services/search/FindingService/v1";

// Trading Cards parent category — graded cards live here
const TCG_CATEGORY_ID = "183454";

export interface GradedPriceResult {
  marketPriceUsd: number;
  sampleSize: number;
  priceSource: string;
}

const COMPANY_LABELS: Record<GradingCompany, string> = {
  psa: "PSA",
  bgs: "BGS",
  cgc: "CGC",
  sgc: "SGC",
  tag: "TAG",
  ars: "ARS",
};

/**
 * Look up recent sold prices for a graded card on eBay.
 * Query is built as "{Company} {Grade} {Card Name}" e.g. "PSA 10 Charizard Holo"
 * Returns the median sold price from the last 20 matching completed listings.
 */
export async function getGradedCardPrice(
  company: GradingCompany,
  grade: string,
  cardName: string,
  setName?: string
): Promise<GradedPriceResult | null> {
  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId || !cardName || !grade) return null;

  const companyLabel = COMPANY_LABELS[company] ?? company.toUpperCase();

  // Build keyword string: "PSA 10 Charizard Holo Base Set"
  const parts = [companyLabel, grade, cardName];
  if (setName) parts.push(setName);
  const keywords = parts.join(" ");

  const result = await searchSold(keywords, appId, TCG_CATEGORY_ID);
  if (result) return result;

  // Fallback: broaden to no category
  return searchSold(keywords, appId, null);
}

async function searchSold(
  keywords: string,
  appId: string,
  categoryId: string | null
): Promise<GradedPriceResult | null> {
  const params = new URLSearchParams({
    "OPERATION-NAME":                 "findCompletedItems",
    "SERVICE-VERSION":                "1.0.0",
    "SECURITY-APPNAME":               appId,
    "RESPONSE-DATA-FORMAT":           "JSON",
    "REST-PAYLOAD":                   "",
    keywords,
    "itemFilter(0).name":             "SoldItemsOnly",
    "itemFilter(0).value":            "true",
    "sortOrder":                      "EndTimeSoonest",
    "paginationInput.entriesPerPage": "20",
  });

  if (categoryId) {
    params.set("categoryId", categoryId);
  }

  try {
    const res = await fetch(`${FINDING_API}?${params.toString()}`, {
      headers: { "Content-Type": "application/json" },
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
        return price
          ? parseFloat((price as Record<string, unknown>).__value__ as string)
          : null;
      })
      .filter((p): p is number => p !== null && p > 0);

    if (prices.length === 0) return null;

    return {
      marketPriceUsd: median(prices),
      sampleSize: prices.length,
      priceSource: categoryId
        ? "eBay sold listings (graded)"
        : "eBay sold listings (broad)",
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
