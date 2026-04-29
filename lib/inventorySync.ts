// DEPRECATED — This file is no longer used for logic.
// Inventory tracking is now handled by lib/supabaseInventoryStore.ts (Supabase-backed).
// Type definitions have moved to lib/inventoryTypes.ts.
//
// Re-exporting types here only for backward compatibility with any straggling imports.
// Safe to delete once all consumers have been updated.

export type {
  InventoryStatus,
  SyncEventType,
  PlatformListing,
  InventoryItem,
  SyncEvent,
  QuantityConflict,
  InventorySnapshot,
} from "./inventoryTypes";
