// POST /api/ebay/sync
//
// Triggers a poll-based sync of eBay inventory state.
// Called manually from the Inventories page "Sync Now" button,
// or could be called on a cron schedule.
//
// GET /api/ebay/sync
//
// Returns current sync status (last sync times, health, event count).

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { syncEbayInventory } from "@/lib/ebay/sync";
import { getSyncStatus, getRecentSyncEvents } from "@/lib/ebaySyncStore";

export const runtime = "nodejs";

// Get sync status
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const status = getSyncStatus();
  const recentEvents = getRecentSyncEvents(20);

  return NextResponse.json({
    status,
    recentEvents,
  });
}

// Trigger a sync
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    const auth = await requireAuth(req);
    userId = auth.user.id;
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const result = await syncEbayInventory(userId);
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err) {
    console.error("[/api/ebay/sync]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
