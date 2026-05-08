// Price alert engine for wishlist items.
//
// Called by the daily CRON job. For each wishlist item that has:
//   - alert_enabled = true
//   - alert_price_usd set
//   - found = false
//   - alert not already sent in the last 24 h
//
// We fetch a current eBay sold-listings median and, if it falls at or below
// the user's target, send a Resend email and stamp alert_sent_at.

import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const FINDING_API =
  "https://svcs.ebay.com/services/search/FindingService/v1";

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h

// ── eBay price lookup (generic keyword search) ────────────────────────────────

interface EbayPrice {
  median: number;
  samples: number;
}

async function getEbayPrice(keywords: string): Promise<EbayPrice | null> {
  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId) return null;

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
        const ss = (i.sellingStatus as Record<string, unknown>[])?.[0];
        const cp = (ss?.currentPrice as Record<string, unknown>[])?.[0];
        return cp ? parseFloat((cp as Record<string, unknown>).__value__ as string) : null;
      })
      .filter((p): p is number => p !== null && p > 0);

    if (prices.length === 0) return null;
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    return { median: Math.round(median * 100) / 100, samples: prices.length };
  } catch {
    return null;
  }
}

// ── Email via Resend ──────────────────────────────────────────────────────────

async function sendAlertEmail({
  to,
  cardName,
  game,
  setName,
  alertPrice,
  currentPrice,
  samples,
}: {
  to: string;
  cardName: string;
  game: string;
  setName?: string | null;
  alertPrice: number;
  currentPrice: number;
  samples: number;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "SnapList <noreply@snaplist.gg>";
  if (!resendKey) return false;

  const cardLabel = [cardName, setName].filter(Boolean).join(" — ");
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${game} ${cardName}`)}&LH_Sold=1&LH_Complete=1`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#0e0e1a;color:#e2e2f0;padding:32px;margin:0">
  <div style="max-width:480px;margin:0 auto">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <span style="font-size:22px">🏷️</span>
      <span style="font-size:18px;font-weight:700;color:#7c6ef3">SnapList</span>
    </div>

    <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">Price alert hit!</h2>
    <p style="color:#999;margin:0 0 24px;font-size:14px">
      A card on your wishlist is at or below your target price.
    </p>

    <div style="background:#14141f;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:20px">
      <p style="font-size:18px;font-weight:700;margin:0 0 4px">${cardLabel}</p>
      <p style="font-size:13px;color:#888;margin:0 0 16px;text-transform:capitalize">${game}</p>

      <div style="display:flex;gap:24px">
        <div>
          <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2px">Current Market</p>
          <p style="font-size:24px;font-weight:800;color:#7c6ef3;margin:0">$${currentPrice.toFixed(2)}</p>
          <p style="font-size:11px;color:#666;margin:4px 0 0">${samples} eBay sold</p>
        </div>
        <div>
          <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2px">Your Alert</p>
          <p style="font-size:24px;font-weight:800;color:#22c55e;margin:0">$${alertPrice.toFixed(2)}</p>
        </div>
      </div>
    </div>

    <a href="${ebayUrl}"
       style="display:inline-block;background:#7c6ef3;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px">
      View eBay Listings →
    </a>

    <p style="font-size:12px;color:#555;margin:0">
      You're receiving this because you set a price alert in SnapList.
      <a href="https://snaplist.gg/collection" style="color:#7c6ef3">Manage your wishlist</a>
    </p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `🏷️ Price alert: ${cardLabel} is now $${currentPrice.toFixed(2)}`,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export interface AlertRunResult {
  checked: number;
  alerted: number;
  skipped: number;
  errors: number;
}

export async function runPriceAlerts(): Promise<AlertRunResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();

  // Fetch all active alert items that haven't been alerted in the cooldown window
  const { data: items, error } = await supabase
    .from("wishlist_items")
    .select(`
      id, name, game, set_name, alert_price_usd, alert_sent_at,
      user_id
    `)
    .eq("alert_enabled", true)
    .eq("found", false)
    .not("alert_price_usd", "is", null)
    .or(`alert_sent_at.is.null,alert_sent_at.lt.${cutoff}`);

  if (error) {
    logger.error("priceAlerts: failed to fetch items", { message: error.message });
    return { checked: 0, alerted: 0, skipped: 0, errors: 1 };
  }

  if (!items || items.length === 0) {
    logger.info("priceAlerts: no active alerts to check");
    return { checked: 0, alerted: 0, skipped: 0, errors: 0 };
  }

  logger.info("priceAlerts: checking items", { count: items.length });

  // Fetch emails for all unique user IDs in one query
  const userIds = [...new Set(items.map((i) => i.user_id))];
  const { data: users } = await supabase.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  for (const u of users?.users ?? []) {
    if (userIds.includes(u.id) && u.email) {
      emailMap.set(u.id, u.email);
    }
  }

  const result: AlertRunResult = { checked: items.length, alerted: 0, skipped: 0, errors: 0 };
  const now = new Date().toISOString();

  for (const item of items) {
    const userEmail = emailMap.get(item.user_id);
    if (!userEmail) { result.skipped++; continue; }

    // Build search query: game + card name + optional set
    const gameParts = item.game !== "other" ? [item.game] : [];
    const keywords = [...gameParts, item.name, item.set_name]
      .filter(Boolean)
      .join(" ");

    // Always stamp last_checked_at regardless of outcome
    await supabase
      .from("wishlist_items")
      .update({ last_checked_at: now })
      .eq("id", item.id);

    const priceData = await getEbayPrice(keywords);
    if (!priceData) { result.skipped++; continue; }

    const alertPrice = Number(item.alert_price_usd);
    if (priceData.median > alertPrice) {
      // Price hasn't hit the target yet
      result.skipped++;
      continue;
    }

    // Price is at or below target — send the alert
    const sent = await sendAlertEmail({
      to: userEmail,
      cardName: item.name,
      game: item.game,
      setName: item.set_name,
      alertPrice,
      currentPrice: priceData.median,
      samples: priceData.samples,
    });

    if (sent) {
      await supabase
        .from("wishlist_items")
        .update({ alert_sent_at: now })
        .eq("id", item.id);
      result.alerted++;
      logger.info("priceAlerts: alert sent", { itemId: item.id, price: priceData.median, target: alertPrice });
    } else {
      result.errors++;
      logger.warn("priceAlerts: email failed", { itemId: item.id });
    }
  }

  return result;
}
