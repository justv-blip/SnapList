/**
 * Market analysis utilities — price trend and buy/hold/sell signals.
 *
 * Integrates with MyCollectibles.com (when available) and falls back
 * to internal heuristics based on current market data.
 */

export type MarketSignal = "buy" | "hold" | "sell";
export type TrendDirection = "up" | "down" | "stable";

export interface MarketDataPoint {
  date: string;         // ISO date
  price: number;        // USD
  volume?: number;      // Number of sales
}

export interface MarketAnalysis {
  cardName: string;
  game: string;
  setName?: string;
  currentPrice: number;
  averagePrice30d: number;
  averagePrice90d: number;
  trend7d: TrendDirection;
  trend30d: TrendDirection;
  priceChange7dPercent: number;
  priceChange30dPercent: number;
  signal: MarketSignal;
  signalConfidence: number;   // 0-1
  signalReasoning: string;
  priceHistory: MarketDataPoint[];
  source: "justtcg" | "internal";
  lastUpdated: string;
}

/**
 * Determine a buy/hold/sell signal based on price trend data.
 */
export function computeSignal(
  currentPrice: number,
  avg30d: number,
  avg90d: number,
  change7dPercent: number,
  change30dPercent: number
): { signal: MarketSignal; confidence: number; reasoning: string } {
  // Strong uptrend — sell window
  if (change7dPercent > 15 && change30dPercent > 20) {
    return {
      signal: "sell",
      confidence: 0.8,
      reasoning: `Price surging ${change7dPercent.toFixed(0)}% in 7 days and ${change30dPercent.toFixed(0)}% in 30 days. Consider selling to lock in gains before a correction.`,
    };
  }

  // Moderate uptrend — hold
  if (change30dPercent > 5 && change7dPercent > 0) {
    return {
      signal: "hold",
      confidence: 0.7,
      reasoning: `Steady upward trend of ${change30dPercent.toFixed(0)}% over 30 days. Price is climbing — hold for potential further gains.`,
    };
  }

  // Strong downtrend — buy opportunity
  if (change30dPercent < -15 && currentPrice < avg90d * 0.85) {
    return {
      signal: "buy",
      confidence: 0.75,
      reasoning: `Price dropped ${Math.abs(change30dPercent).toFixed(0)}% in 30 days and is ${((1 - currentPrice / avg90d) * 100).toFixed(0)}% below 90-day average. Potential buying opportunity if fundamentals haven't changed.`,
    };
  }

  // Below average — potential buy
  if (currentPrice < avg30d * 0.9) {
    return {
      signal: "buy",
      confidence: 0.6,
      reasoning: `Current price is ${((1 - currentPrice / avg30d) * 100).toFixed(0)}% below 30-day average. Could be a dip worth buying.`,
    };
  }

  // Above average — consider selling
  if (currentPrice > avg30d * 1.15) {
    return {
      signal: "sell",
      confidence: 0.6,
      reasoning: `Price is ${(((currentPrice / avg30d) - 1) * 100).toFixed(0)}% above 30-day average. Consider taking profits.`,
    };
  }

  // Stable — hold
  return {
    signal: "hold",
    confidence: 0.5,
    reasoning: "Price is stable with no strong directional signals. Hold and monitor for changes.",
  };
}

/**
 * Determine trend direction from a percentage change.
 */
export function trendFromChange(changePercent: number): TrendDirection {
  if (changePercent > 3) return "up";
  if (changePercent < -3) return "down";
  return "stable";
}

/**
 * Fetch market analysis from MyCollectibles.com.
 * Currently a placeholder — will be connected when API access is available.
 */
export async function fetchMarketAnalysis(
  cardName: string,
  game: string,
  setName?: string
): Promise<MarketAnalysis | null> {
  try {
    const res = await fetch("/api/market-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardName, game, setName }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
