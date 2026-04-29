// Inventory type definitions — shared between supabaseInventoryStore, ebaySyncStore,
// and any UI components that work with inventory data.

import type { ExportPlatform } from "./types";

export type InventoryStatus = "draft" | "active" | "sold" | "ended" | "delisted" | "error";

export type SyncEventType =
  | "listed"       // card was listed on a platform
  | "sold"         // card was sold
  | "delisted"     // listing was manually ended or removed
  | "repriced"     // price was updated on the platform
  | "quantity_changed" // quantity was updated
  | "sync_error"   // sync attempt failed
  | "imported";    // listing was imported from a platform

export interface PlatformListing {
  platform: ExportPlatform;
  listingId: string;          // platform-specific ID (eBay item ID, TCGPlayer ID, etc.)
  listingUrl?: string;        // direct URL to the listing
  status: InventoryStatus;
  listPrice: number;
  quantity: number;
  listedAt: number;           // timestamp
  soldAt?: number;
  lastSyncedAt: number;
  views?: number;
  watchers?: number;
  offers?: number;
}

export interface InventoryItem {
  cardId: string;             // maps to ScannedCard.id
  cardName: string;
  game: string;
  setName?: string;
  imageUrl?: string;
  sku?: string;
  totalQuantity: number;      // total physical cards in hand
  listedQuantity: number;     // sum of quantities across all platforms
  availableQuantity: number;  // totalQuantity - listedQuantity (should be >= 0)
  listings: PlatformListing[];
  createdAt: number;
  updatedAt: number;
}

export interface SyncEvent {
  id: string;
  cardId: string;
  platform: ExportPlatform;
  type: SyncEventType;
  details: string;
  timestamp: number;
  listingId?: string;
  previousValue?: string;
  newValue?: string;
}

export interface QuantityConflict {
  cardId: string;
  cardName: string;
  sku?: string;
  totalQuantity: number;
  listedQuantity: number;
  deficit: number;             // how many more are listed than physically available
  platforms: { platform: ExportPlatform; quantity: number }[];
}

export interface InventorySnapshot {
  items: InventoryItem[];
  totalCards: number;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalListedValue: number;
  totalSoldValue: number;
  conflicts: QuantityConflict[];
  lastUpdated: number;
}
