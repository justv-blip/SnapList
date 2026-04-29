// GET /api/ebay/policies?type=fulfillment|return|payment
// Fetches the user's eBay business policies for populating dropdowns.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { isEbayConnected } from "@/lib/ebay/client";
import { getFulfillmentPolicies } from "@/lib/ebay/listings";

const VALID_TYPES = ["fulfillment", "return", "payment"] as const;
type PolicyType = (typeof VALID_TYPES)[number];

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const connected = await isEbayConnected(user.id);
    if (!connected) {
      return NextResponse.json(
        { error: "eBay not connected" },
        { status: 400 }
      );
    }

    const policyType = request.nextUrl.searchParams.get("type") as PolicyType | null;
    if (!policyType || !VALID_TYPES.includes(policyType)) {
      return NextResponse.json(
        { error: "Invalid policy type. Use: fulfillment, return, or payment" },
        { status: 400 }
      );
    }

    const policies = await getFulfillmentPolicies(user.id, policyType);
    return NextResponse.json({ policies });
  } catch (err) {
    return authErrorResponse(err);
  }
}
