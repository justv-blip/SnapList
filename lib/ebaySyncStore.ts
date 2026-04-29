// eBay sync store — server-side helpers for looking up inventory by listing ID
// and logging sync events. Used by both the webhook handler and polling service.
//
// Now backed by Supabase (inventory_items + platform_listings + sync_events).
// Webhooks use the admin client (service_role) to bypass RLS.
// Falls back to in-memory registry for development when Supabase isn't configured.

import type { ExportPlatform } from "./types";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// ---- Admin client ----

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key);
}

// ---- Sync event log ----

export interface WebhookSyncEvent {
  type: "webhook_received" | "poll_sync" | "manual_sync";
  topic: string;
  details: string;
  status: "processed" | "skipped" | "error";
  itemId?: string;
  timestamp?: number;
}

// In-memory fallback for dev (when Supabase isn't configured)
const syncEventLog: WebhookSyncEvent[] = [];
const MAX_EVENTS = 200;

export async function logSyncEvent(event: WebhookSyncEvent): Promise<void> {
  const entry = { ...event, timestamp: event.timestamp || Date.now() };

  // Always keep in-memory copy for dev/getRecentSyncEvents fallback
  syncEventLog.push(entry);
  if (syncEventLog.length > MAX_EVENTS) {
    syncEventLog.splice(0, syncEventLog.length - MAX_EVENTS);
  }

  // Persist to Supabase sync_events table
  const admin = getAdminClient();
  if (admin) {
    try {
      await admin.from("sync_events").insert({
        type: entry.type,
        topic: entry.topic,
        details: entry.details,
        status: entry.status,
        item_id: entry.itemId || null,
        created_at: new Date(entry.timestamp).toISOString(),
      });
    } catch {
      // Best-effort
    }
  }
}

export async function getRecentSyncEvents(limit: number = 50): Promise<WebhookSyncEvent[]> {
  const admin = getAdminClient();
  if (admin) {
    try {
      const { data } = await admin
        .from("sync_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (data && data.length > 0) {
        return data.map((row: any) => ({
          type: row.type,
          topic: row.topic || "",
          details: row.details || "",
          status: row.status || "processed",
          itemId: row.item_id || undefined,
          timestamp: new Date(row.created_at).getTime(),
        }));
      }
    } catch {
      // Fall through to in-memory
    }
  }

  return syncEventLog.slice(-limit).reverse();
}

// ---- Inventory lookup by listing ID ----

// In-memory fallback registry (populated when Supabase isn't available)
const listingRegistry = new Map<string, { cardId: string; cardName: string }>();

/**
 * Register a listing so webhooks can find the matching inventory item.
 * Writes to Supabase if available, otherwise in-memory only.
 */
export function registerListing(
  platform: ExportPlatform,
  listingId: string,
  cardId: string,
  cardName: string
): void {
  // Always keep in-memory for fast lookups
  listingRegistry.set(`${platform}:${listingId}`, { cardId, cardName });
}

/**
 * Find an inventory item by its platform listing ID.
 * Used by webhook handlers to map eBay item IDs back to our cards.
 *
 * Queries Supabase first (works server-side), falls back to in-memory registry.
 */
export async function findInventoryByListingId(
  platform: ExportPlatform,
  listingId: string
): Promise<{ cardId: string; cardName: string } | null> {
  // Try Supabase first
  const admin = getAdminClient();
  if (admin) {
    try {
      const { data } = await admin
        .from("platform_listings")
        .select("inventory_item_id, inventory_items!inner(card_id, card_name)")
        .eq("platform", platform)
        .eq("listing_id", listingId)
        .single();

      if (data) {
        const inv = (data as any).inventory_items;
        return { cardId: inv.card_id, cardName: inv.card_name };
      }
    } catch {
      // Fall through to in-memory
    }
  }

  // Fallback: in-memory registry
  return listingRegistry.get(`${platform}:${listingId}`) || null;
}

/**
 * Bulk register listings (e.g., after loading inventory from Supabase).
 */
export function bulkRegisterListings(
  entries: { platform: ExportPlatform; listingId: string; cardId: string; cardName: string }[]
): void {
  for (const entry of entries) {
    registerListing(entry.platform, entry.listingId, entry.cardId, entry.cardName);
  }
}

/**
 * Get the count of registered listings.
 */
export function getRegistrySize(): number {
  return listingRegistry.size;
}

// ---- Sync status tracking ----

export interface SyncStatus {
  lastWebhookAt: number | null;
  lastPollAt: number | null;
  lastManualSyncAt: number | null;
  webhookHealthy: boolean;
  totalEventsProcessed: number;
  registeredListings: number;
}

let lastWebhookAt: number | null = null;
let lastPollAt: number | null = null;
let lastManualSyncAt: number | null = null;
let webhookHealthy = false;
let totalEventsProcessed = 0;

export function updateSyncTimestamp(type: "webhook" | "poll" | "manual"): void {
  const now = Date.now();
  if (type === "webhook") { lastWebhookAt = now; webhookHealthy = true; }
  else if (type === "poll") lastPollAt = now;
  else lastManualSyncAt = now;
  totalEventsProcessed++;
}

export function getSyncStatus(): SyncStatus {
  return {
    lastWebhookAt,
    lastPollAt,
    lastManualSyncAt,
    webhookHealthy,
    totalEventsProcessed,
    registeredListings: listingRegistry.size,
  };
}
