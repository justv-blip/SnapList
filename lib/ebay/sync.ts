// eBay polling sync — fetches current listing/order state from eBay APIs
// and reconciles with local inventory.
//
// This is the fallback path that catches anything webhooks miss.
// Called on-demand via /api/ebay/sync or on a schedule.
//
// Flow:
//   1. Fetch active listings from eBay (Sell API)
//   2. Fetch recent orders (Fulfillment API)
//   3. Compare against local inventory state
//   4. Apply changes (sold, ended, repriced, quantity changed)
//   5. Log sync events

import { ebayFetch } from "./client";
import {
  logSyncEvent,
  registerListing,
  updateSyncTimestamp,
} from "../ebaySyncStore";

// ---- Types ----

export interface SyncResult {
  synced: number;
  sold: number;
  ended: number;
  repriced: number;
  errors: string[];
  duration: number;
}

export interface EbayActiveListing {
  listingId: string;
  sku: string;
  title: string;
  price: number;
  quantity: number;
  quantityAvailable: number;
  quantitySold: number;
  status: string;
  listingUrl: string;
  imageUrl?: string;
  startTime?: string;
}

export interface EbayOrder {
  orderId: string;
  lineItems: {
    itemId: string;
    sku: string;
    title: string;
    quantity: number;
    price: number;
  }[];
  createdDate: string;
  orderStatus: string;
}

// ---- Fetch active listings from eBay ----

export async function fetchActiveListings(userId: string): Promise<EbayActiveListing[]> {
  const listings: EbayActiveListing[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const res = await ebayFetch(
      userId,
      `/sell/inventory/v1/offer?limit=${limit}&offset=${offset}&marketplace_id=EBAY_US`
    );

    if (!res.ok) {
      console.error(`[eBay Sync] Failed to fetch offers: ${res.status}`);
      break;
    }

    const data = await res.json();
    const offers = data.offers || [];

    for (const offer of offers) {
      listings.push({
        listingId: offer.listing?.listingId || "",
        sku: offer.sku || "",
        title: offer.listing?.listingTitle || offer.sku || "",
        price: Number(offer.pricingSummary?.price?.value || 0),
        quantity: offer.availableQuantity || 0,
        quantityAvailable: offer.availableQuantity || 0,
        quantitySold: 0,
        status: offer.status || "ACTIVE",
        listingUrl: offer.listing?.listingId
          ? `https://www.ebay.com/itm/${offer.listing.listingId}`
          : "",
      });
    }

    offset += offers.length;
    hasMore = offers.length === limit;
  }

  return listings;
}

// ---- Fetch recent orders from eBay ----

export async function fetchRecentOrders(
  userId: string,
  sinceDaysAgo: number = 7
): Promise<EbayOrder[]> {
  const since = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000).toISOString();
  const orders: EbayOrder[] = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const filter = `creationdate:[${since}..],orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS|FULFILLED}`;
    const res = await ebayFetch(
      userId,
      `/sell/fulfillment/v1/order?filter=${encodeURIComponent(filter)}&limit=${limit}&offset=${offset}`
    );

    if (!res.ok) {
      console.error(`[eBay Sync] Failed to fetch orders: ${res.status}`);
      break;
    }

    const data = await res.json();
    const pageOrders = data.orders || [];

    for (const order of pageOrders) {
      orders.push({
        orderId: order.orderId,
        lineItems: (order.lineItems || []).map((li: any) => ({
          itemId: li.legacyItemId || li.lineItemId || "",
          sku: li.sku || "",
          title: li.title || "",
          quantity: li.quantity || 1,
          price: Number(li.lineItemCost?.value || 0),
        })),
        createdDate: order.creationDate || "",
        orderStatus: order.orderFulfillmentStatus || "",
      });
    }

    offset += pageOrders.length;
    hasMore = pageOrders.length === limit;
  }

  return orders;
}

// ---- Full sync: reconcile eBay state with local inventory ----

export async function syncEbayInventory(userId: string): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    synced: 0,
    sold: 0,
    ended: 0,
    repriced: 0,
    errors: [],
    duration: 0,
  };

  try {
    // Dynamically import inventory functions (avoids client/server module issues)
    const { getInventorySnapshot, recordSale, recordDelist, recordReprice } =
      await import("../supabaseInventoryStore");

    // 1. Get current inventory state from Supabase
    const snapshot = await getInventorySnapshot();
    const localListings = new Map<string, { cardId: string; cardName: string; price: number; status: string }>();

    for (const item of snapshot.items) {
      for (const listing of item.listings) {
        if (listing.platform === "ebay") {
          localListings.set(listing.listingId, {
            cardId: item.cardId,
            cardName: item.cardName,
            price: listing.listPrice,
            status: listing.status,
          });
          // Register in the server-side registry for webhook matching
          registerListing("ebay", listing.listingId, item.cardId, item.cardName);
        }
      }
    }

    // 2. Fetch active listings from eBay
    const ebayListings = await fetchActiveListings(userId);

    // Build a set of active eBay listing IDs
    const activeEbayIds = new Set(
      ebayListings
        .filter((l) => l.listingId && l.status === "ACTIVE")
        .map((l) => l.listingId)
    );

    // 3. Check for price changes on active listings
    for (const ebayListing of ebayListings) {
      if (!ebayListing.listingId) continue;
      const local = localListings.get(ebayListing.listingId);
      if (!local) continue;

      // Register listing for webhook matching
      registerListing("ebay", ebayListing.listingId, local.cardId, local.cardName);

      // Check for price changes
      if (
        local.price > 0 &&
        ebayListing.price > 0 &&
        Math.abs(local.price - ebayListing.price) > 0.01
      ) {
        await recordReprice(local.cardId, "ebay", ebayListing.listingId, ebayListing.price);
        result.repriced++;
      }

      result.synced++;
    }

    // 4. Check for ended listings (in local inventory but not active on eBay)
    for (const [listingId, local] of localListings.entries()) {
      if (local.status === "active" && !activeEbayIds.has(listingId)) {
        // Listing is active locally but not on eBay — it was ended or sold
        // We'll check orders to distinguish
        await recordDelist(local.cardId, "ebay", listingId);
        result.ended++;
        result.synced++;
      }
    }

    // 5. Fetch recent orders to catch sales
    const orders = await fetchRecentOrders(userId);

    for (const order of orders) {
      for (const lineItem of order.lineItems) {
        const local = localListings.get(lineItem.itemId);
        if (local && local.status !== "sold") {
          // This was sold, not just ended
          await recordSale(local.cardId, "ebay", lineItem.itemId, lineItem.quantity);
          result.sold++;
          // Undo the delist we may have just recorded
          if (result.ended > 0) result.ended--;
        }
      }
    }

    updateSyncTimestamp("poll");

    await logSyncEvent({
      type: "poll_sync",
      topic: "full_sync",
      details: `Synced ${result.synced} listings: ${result.sold} sold, ${result.ended} ended, ${result.repriced} repriced`,
      status: result.errors.length > 0 ? "error" : "processed",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    result.errors.push(message);
    console.error("[eBay Sync] Error:", message);

    await logSyncEvent({
      type: "poll_sync",
      topic: "sync_error",
      details: message,
      status: "error",
    });
  }

  result.duration = Date.now() - start;
  return result;
}
