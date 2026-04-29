// Supabase-backed inventory store — replaces localStorage-based inventorySync.
//
// Works in two contexts:
//   Client-side (inventories page): uses browser Supabase client with user auth
//   Server-side (webhooks, sync): uses admin client with service_role key
//
// The API mirrors inventorySync.ts so consumers can switch imports with
// minimal changes. All functions are async.

import type { ExportPlatform, ScannedCard } from "./types";
import type {
  InventoryItem,
  InventoryStatus,
  PlatformListing,
  SyncEvent,
  SyncEventType,
  InventorySnapshot,
  QuantityConflict,
} from "./inventoryTypes";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// Re-export types so consumers can import from this module
export type {
  InventoryItem,
  InventoryStatus,
  PlatformListing,
  SyncEvent,
  SyncEventType,
  InventorySnapshot,
  QuantityConflict,
};

// ---------------------------------------------------------------------------
// Client helpers
// ---------------------------------------------------------------------------

/** Get a Supabase client — browser client in client context, admin in server. */
function getClient() {
  if (typeof window !== "undefined") {
    return createBrowserClient();
  }
  // Server-side: use service role
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseAdmin(url, key);
}

/** Get the admin client (service role, bypasses RLS). For server-side only. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseAdmin(url, key);
}

/** Get the current user ID (client-side only). */
async function getUserId(): Promise<string> {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ---------------------------------------------------------------------------
// DB row → domain type mappers
// ---------------------------------------------------------------------------

interface DbInventoryRow {
  id: string;
  user_id: string;
  card_id: string;
  card_name: string;
  game: string;
  set_name: string | null;
  image_url: string | null;
  sku: string | null;
  total_quantity: number;
  listed_quantity: number;
  available_quantity: number;
  created_at: string;
  updated_at: string;
}

interface DbListingRow {
  id: string;
  user_id: string;
  inventory_item_id: string;
  platform: string;
  listing_id: string;
  listing_url: string | null;
  status: string;
  list_price: number;
  quantity: number;
  listed_at: string;
  sold_at: string | null;
  last_synced_at: string;
  views: number | null;
  watchers: number | null;
  offers: number | null;
}

function dbToListing(row: DbListingRow): PlatformListing {
  return {
    platform: row.platform as ExportPlatform,
    listingId: row.listing_id,
    listingUrl: row.listing_url || undefined,
    status: row.status as InventoryStatus,
    listPrice: Number(row.list_price),
    quantity: row.quantity,
    listedAt: new Date(row.listed_at).getTime(),
    soldAt: row.sold_at ? new Date(row.sold_at).getTime() : undefined,
    lastSyncedAt: new Date(row.last_synced_at).getTime(),
    views: row.views ?? undefined,
    watchers: row.watchers ?? undefined,
    offers: row.offers ?? undefined,
  };
}

function dbToInventoryItem(
  row: DbInventoryRow,
  listings: DbListingRow[]
): InventoryItem {
  return {
    cardId: row.card_id,
    cardName: row.card_name,
    game: row.game,
    setName: row.set_name || undefined,
    imageUrl: row.image_url || undefined,
    sku: row.sku || undefined,
    totalQuantity: row.total_quantity,
    listedQuantity: row.listed_quantity,
    availableQuantity: row.available_quantity,
    listings: listings.map(dbToListing),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Record that a card was listed on a platform.
 * Creates or updates the inventory item and adds a platform listing entry.
 */
export async function recordListing(
  card: ScannedCard,
  platform: ExportPlatform,
  listingId: string,
  listPrice: number,
  quantity?: number,
  listingUrl?: string,
  userId?: string
): Promise<InventoryItem | null> {
  const supabase = getClient();
  const uid = userId || await getUserId();
  const qty = quantity ?? card.quantity ?? 1;
  const now = new Date().toISOString();

  // Upsert inventory item
  const { data: invRow, error: invErr } = await supabase
    .from("inventory_items")
    .upsert(
      {
        user_id: uid,
        card_id: card.id,
        card_name: card.name,
        game: card.game,
        set_name: card.setName || null,
        image_url: card.imageUrl || null,
        sku: card.sku || null,
        total_quantity: card.quantity || 1,
        updated_at: now,
      },
      { onConflict: "user_id,card_id" }
    )
    .select()
    .single();

  if (invErr || !invRow) {
    console.error("[inventory] Failed to upsert inventory item:", invErr);
    return null;
  }

  // Upsert platform listing
  const { error: listErr } = await supabase
    .from("platform_listings")
    .upsert(
      {
        user_id: uid,
        inventory_item_id: invRow.id,
        platform,
        listing_id: listingId,
        listing_url: listingUrl || null,
        status: "active",
        list_price: listPrice,
        quantity: qty,
        listed_at: now,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,platform,listing_id" }
    );

  if (listErr) {
    console.error("[inventory] Failed to upsert listing:", listErr);
  }

  // Recalculate quantities
  await recalculateQuantities(supabase, invRow.id);

  // Log sync event
  await logSyncEvent({
    userId: uid,
    cardId: card.id,
    platform,
    type: "listed",
    details: `Listed on ${platform} at $${listPrice.toFixed(2)} (qty: ${qty})`,
    listingId,
  });

  // Fetch the updated item with listings
  return getInventoryForCard(card.id, uid);
}

/**
 * Mark a listing as sold.
 */
export async function recordSale(
  cardId: string,
  platform: ExportPlatform,
  listingId: string,
  quantitySold?: number,
  userId?: string
): Promise<InventoryItem | null> {
  const supabase = getClient();
  const now = new Date().toISOString();

  // Find the listing
  const { data: listing } = await supabase
    .from("platform_listings")
    .select("*, inventory_items!inner(card_id, user_id)")
    .eq("platform", platform)
    .eq("listing_id", listingId)
    .single();

  if (!listing) return null;

  const qty = quantitySold ?? listing.quantity;

  // Update listing status
  await supabase
    .from("platform_listings")
    .update({ status: "sold", sold_at: now, last_synced_at: now, updated_at: now })
    .eq("id", listing.id);

  // Decrease total quantity — update directly since we don't have an RPC for this yet
  try {
    const { data: currentItem } = await supabase
      .from("inventory_items")
      .select("total_quantity")
      .eq("id", listing.inventory_item_id)
      .single();

    if (currentItem) {
      await supabase
        .from("inventory_items")
        .update({
          total_quantity: Math.max(0, currentItem.total_quantity - qty),
          updated_at: now,
        })
        .eq("id", listing.inventory_item_id);
    }
  } catch {
    // Non-critical — recalculateQuantities will fix it below
  }

  await recalculateQuantities(supabase, listing.inventory_item_id);

  const uid = userId || listing.user_id;
  await logSyncEvent({
    userId: uid,
    cardId,
    platform,
    type: "sold",
    details: `Sold on ${platform} (qty: ${qty}, price: $${Number(listing.list_price).toFixed(2)})`,
    listingId,
  });

  return getInventoryForCard(cardId, uid);
}

/**
 * Delist / end a listing.
 */
export async function recordDelist(
  cardId: string,
  platform: ExportPlatform,
  listingId: string,
  userId?: string
): Promise<InventoryItem | null> {
  const supabase = getClient();
  const now = new Date().toISOString();

  const { data: listing } = await supabase
    .from("platform_listings")
    .select("*, inventory_items!inner(card_id, user_id)")
    .eq("platform", platform)
    .eq("listing_id", listingId)
    .single();

  if (!listing) return null;

  await supabase
    .from("platform_listings")
    .update({ status: "delisted", last_synced_at: now, updated_at: now })
    .eq("id", listing.id);

  await recalculateQuantities(supabase, listing.inventory_item_id);

  const uid = userId || listing.user_id;
  await logSyncEvent({
    userId: uid,
    cardId,
    platform,
    type: "delisted",
    details: `Delisted from ${platform}`,
    listingId,
  });

  return getInventoryForCard(cardId, uid);
}

/**
 * Update listing price on a platform.
 */
export async function recordReprice(
  cardId: string,
  platform: ExportPlatform,
  listingId: string,
  newPrice: number,
  userId?: string
): Promise<InventoryItem | null> {
  const supabase = getClient();
  const now = new Date().toISOString();

  const { data: listing } = await supabase
    .from("platform_listings")
    .select("*, inventory_items!inner(card_id, user_id)")
    .eq("platform", platform)
    .eq("listing_id", listingId)
    .single();

  if (!listing) return null;

  const oldPrice = Number(listing.list_price);

  await supabase
    .from("platform_listings")
    .update({ list_price: newPrice, last_synced_at: now, updated_at: now })
    .eq("id", listing.id);

  const uid = userId || listing.user_id;
  await logSyncEvent({
    userId: uid,
    cardId,
    platform,
    type: "repriced",
    details: `Price changed from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)} on ${platform}`,
    listingId,
    previousValue: oldPrice.toFixed(2),
    newValue: newPrice.toFixed(2),
  });

  return getInventoryForCard(cardId, uid);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get inventory for a specific card.
 */
export async function getInventoryForCard(
  cardId: string,
  userId?: string
): Promise<InventoryItem | null> {
  const supabase = getClient();
  const uid = userId || await getUserId();

  const { data: row } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", uid)
    .eq("card_id", cardId)
    .single();

  if (!row) return null;

  const { data: listings } = await supabase
    .from("platform_listings")
    .select("*")
    .eq("inventory_item_id", row.id);

  return dbToInventoryItem(row as DbInventoryRow, (listings || []) as DbListingRow[]);
}

/**
 * Get the full inventory snapshot.
 */
export async function getInventorySnapshot(userId?: string): Promise<InventorySnapshot> {
  const supabase = getClient();
  const uid = userId || await getUserId();
  const now = Date.now();

  const { data: rows } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", uid);

  if (!rows || rows.length === 0) {
    return {
      items: [],
      totalCards: 0,
      totalListings: 0,
      activeListings: 0,
      soldListings: 0,
      totalListedValue: 0,
      totalSoldValue: 0,
      conflicts: [],
      lastUpdated: now,
    };
  }

  const itemIds = rows.map((r) => r.id);
  const { data: allListings } = await supabase
    .from("platform_listings")
    .select("*")
    .in("inventory_item_id", itemIds);

  // Group listings by inventory_item_id
  const listingsByItem = new Map<string, DbListingRow[]>();
  for (const l of (allListings || []) as DbListingRow[]) {
    const key = l.inventory_item_id;
    if (!listingsByItem.has(key)) listingsByItem.set(key, []);
    listingsByItem.get(key)!.push(l);
  }

  const items = rows.map((r) =>
    dbToInventoryItem(r as DbInventoryRow, listingsByItem.get(r.id) || [])
  );

  let totalListings = 0;
  let activeListings = 0;
  let soldListings = 0;
  let totalListedValue = 0;
  let totalSoldValue = 0;

  for (const item of items) {
    for (const listing of item.listings) {
      totalListings++;
      if (listing.status === "active") {
        activeListings++;
        totalListedValue += listing.listPrice * listing.quantity;
      }
      if (listing.status === "sold") {
        soldListings++;
        totalSoldValue += listing.listPrice * listing.quantity;
      }
    }
  }

  const conflicts = detectQuantityConflicts(items);

  return {
    items,
    totalCards: items.length,
    totalListings,
    activeListings,
    soldListings,
    totalListedValue,
    totalSoldValue,
    conflicts,
    lastUpdated: now,
  };
}

/**
 * Get recent sync events.
 */
export async function getRecentEvents(
  limit: number = 50,
  userId?: string
): Promise<SyncEvent[]> {
  const supabase = getClient();
  const uid = userId || await getUserId();

  const { data } = await supabase
    .from("sync_events")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((row) => ({
    id: row.id,
    cardId: row.card_id || "",
    platform: (row.platform || "generic") as ExportPlatform,
    type: row.type as SyncEventType,
    details: row.details || "",
    timestamp: new Date(row.created_at).getTime(),
    listingId: row.listing_id || undefined,
    previousValue: row.previous_value || undefined,
    newValue: row.new_value || undefined,
  }));
}

/**
 * Bulk record listings from an export.
 */
export async function bulkRecordListings(
  cards: ScannedCard[],
  platform: ExportPlatform,
  listingIdFn?: (card: ScannedCard) => string,
  userId?: string
): Promise<InventoryItem[]> {
  const items: InventoryItem[] = [];
  for (const card of cards) {
    const listingId = listingIdFn
      ? listingIdFn(card)
      : card.ebayListingId || card.sku || card.id;
    const price = card.listPrice ?? card.marketPriceUsd ?? 0;
    const result = await recordListing(card, platform, listingId, price, undefined, undefined, userId);
    if (result) items.push(result);
  }
  return items;
}

/**
 * Remove an inventory item entirely.
 */
export async function removeInventoryItem(
  cardId: string,
  userId?: string
): Promise<void> {
  const supabase = getClient();
  const uid = userId || await getUserId();

  // Cascade delete handles platform_listings
  await supabase
    .from("inventory_items")
    .delete()
    .eq("user_id", uid)
    .eq("card_id", cardId);
}

/**
 * Find an inventory item by its platform listing ID.
 * Used by webhook handlers to map eBay item IDs back to our cards.
 * This is the key function that was broken with localStorage.
 */
export async function findByListingId(
  platform: ExportPlatform,
  listingId: string
): Promise<{ cardId: string; cardName: string; userId: string; inventoryItemId: string } | null> {
  const supabase = getAdminClient();

  const { data } = await supabase
    .from("platform_listings")
    .select("inventory_item_id, inventory_items!inner(card_id, card_name, user_id)")
    .eq("platform", platform)
    .eq("listing_id", listingId)
    .single();

  if (!data) return null;

  const inv = data.inventory_items as any;
  return {
    cardId: inv.card_id,
    cardName: inv.card_name,
    userId: inv.user_id,
    inventoryItemId: data.inventory_item_id,
  };
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export function detectQuantityConflicts(items: InventoryItem[]): QuantityConflict[] {
  const conflicts: QuantityConflict[] = [];
  for (const item of items) {
    if (item.availableQuantity < 0) {
      conflicts.push({
        cardId: item.cardId,
        cardName: item.cardName,
        sku: item.sku,
        totalQuantity: item.totalQuantity,
        listedQuantity: item.listedQuantity,
        deficit: Math.abs(item.availableQuantity),
        platforms: item.listings
          .filter((l) => l.status === "active")
          .map((l) => ({ platform: l.platform, quantity: l.quantity })),
      });
    }
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// Sync event logging
// ---------------------------------------------------------------------------

interface LogSyncEventParams {
  userId?: string;
  cardId?: string;
  platform?: ExportPlatform | string;
  type: SyncEventType | string;
  topic?: string;
  details?: string;
  status?: string;
  listingId?: string;
  itemId?: string;
  previousValue?: string;
  newValue?: string;
}

export async function logSyncEvent(params: LogSyncEventParams): Promise<void> {
  try {
    const supabase = getAdminClient();
    await supabase.from("sync_events").insert({
      user_id: params.userId || null,
      card_id: params.cardId || null,
      platform: params.platform || null,
      type: params.type,
      topic: params.topic || null,
      details: params.details || null,
      status: params.status || "processed",
      listing_id: params.listingId || null,
      item_id: params.itemId || null,
      previous_value: params.previousValue || null,
      new_value: params.newValue || null,
    });
  } catch (err) {
    // Best-effort — don't let logging failures break the flow
    console.error("[inventory] Failed to log sync event:", err);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Recalculate listed_quantity and available_quantity from platform_listings. */
async function recalculateQuantities(
  supabase: ReturnType<typeof createBrowserClient>,
  inventoryItemId: string
): Promise<void> {
  const { data: listings } = await supabase
    .from("platform_listings")
    .select("quantity, status")
    .eq("inventory_item_id", inventoryItemId)
    .eq("status", "active");

  const listedQty = (listings || []).reduce((sum, l) => sum + l.quantity, 0);

  const { data: item } = await supabase
    .from("inventory_items")
    .select("total_quantity")
    .eq("id", inventoryItemId)
    .single();

  const totalQty = item?.total_quantity || 0;

  await supabase
    .from("inventory_items")
    .update({
      listed_quantity: listedQty,
      available_quantity: totalQty - listedQty,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inventoryItemId);
}
