// POST /api/ebay/webhooks
//
// Receives eBay marketplace account notifications (Platform Notifications).
// eBay sends JSON payloads for events like item sold, listing ended, etc.
//
// Notification types we handle:
//   - ITEM_SOLD / ORDER_CREATED — mark listing as sold, update inventory
//   - ITEM_ENDED — mark listing as ended/delisted
//   - ITEM_REVISED — listing was updated externally
//
// eBay sends a verification challenge (GET) during webhook registration and
// digitally signed notifications (POST) for actual events.
//
// Signature verification:
//   eBay signs each notification with an Ed25519 or ECDSA key. The
//   `x-ebay-signature` header is a base64-encoded JSON containing:
//     { "alg": "...", "kid": "<keyId>", "signature": "<base64sig>", "digest": "<base64digest>" }
//   We fetch the public key from eBay's key endpoint using the kid, then
//   verify the signature over the payload digest.
//
// Reference: https://developer.ebay.com/api-docs/commerce/notification/overview.html

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// Cache fetched public keys to avoid repeated lookups (kid → PEM)
const publicKeyCache = new Map<string, { key: string; fetchedAt: number }>();
const KEY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// eBay sends a challenge during endpoint registration
export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json({ error: "Missing challenge_code" }, { status: 400 });
  }

  const verificationToken = process.env.EBAY_WEBHOOK_VERIFICATION_TOKEN || "";
  const endpoint = process.env.EBAY_WEBHOOK_ENDPOINT || "";

  // eBay expects: SHA256(challengeCode + verificationToken + endpoint)
  const hash = crypto
    .createHash("sha256")
    .update(challengeCode + verificationToken + endpoint)
    .digest("hex");

  return NextResponse.json({ challengeResponse: hash });
}

// Process incoming notifications
export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text();

  // Verify the eBay signature cryptographically
  const signatureHeader = req.headers.get("x-ebay-signature");
  const verificationEnabled = !!process.env.EBAY_WEBHOOK_VERIFICATION_TOKEN;

  if (verificationEnabled) {
    if (!signatureHeader) {
      console.warn("[eBay Webhooks] Missing x-ebay-signature header");
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
    } else {
      const isValid = await verifyEbaySignature(signatureHeader, rawBody);
      if (!isValid) {
        console.error("[eBay Webhooks] Invalid signature — rejecting");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = body?.metadata?.topic || body?.topic || "";
  const notificationId = body?.metadata?.notificationId || body?.notificationId || "";

  console.log(`[eBay Webhooks] Received: ${topic} (${notificationId})`);

  try {
    await processNotification(topic, body);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[eBay Webhooks] Processing error:", err);
    // Return 200 anyway — eBay retries on non-2xx and we don't want infinite retries
    return NextResponse.json({ status: "error", message: "Processing failed" });
  }
}

// ---------------------------------------------------------------------------
// Notification processing
// ---------------------------------------------------------------------------

interface EbayNotificationPayload {
  metadata?: {
    topic?: string;
    notificationId?: string;
  };
  notification?: {
    data?: Record<string, any>;
    notificationId?: string;
  };
  // Fulfillment / order notifications
  resource?: Record<string, any>;
  topic?: string;
  // Legacy format fields
  ItemID?: string;
  TransactionID?: string;
  SellingStatus?: any;
}

async function processNotification(topic: string, payload: EbayNotificationPayload) {
  // Use Supabase-backed stores for inventory operations
  const { recordSale, recordDelist, recordReprice } = await import("@/lib/supabaseInventoryStore");
  const { logSyncEvent, findInventoryByListingId } = await import("@/lib/ebaySyncStore");

  const data: any = payload.notification?.data || payload.resource || payload;

  switch (topic) {
    // Marketplace account deletion (required by eBay for compliance)
    case "MARKETPLACE_ACCOUNT_DELETION": {
      console.log("[eBay Webhooks] Account deletion notification — would delete user data");
      await logSyncEvent({
        type: "webhook_received",
        topic,
        details: "Account deletion notification received",
        status: "processed",
      });
      break;
    }

    // Item sold — update inventory
    case "ITEM_SOLD":
    case "ORDER_CREATED":
    case "FULFILLMENT": {
      const itemId = data?.itemId || data?.legacyItemId || data?.ItemID || "";
      const quantity = data?.quantity || data?.quantityPurchased || 1;

      if (itemId) {
        // Find matching inventory item by eBay listing ID (queries Supabase)
        const inv = await findInventoryByListingId("ebay", itemId);
        if (inv) {
          await recordSale(inv.cardId, "ebay", itemId, quantity);
          console.log(`[eBay Webhooks] Recorded sale: ${inv.cardName} (${itemId})`);
        } else {
          console.log(`[eBay Webhooks] No inventory match for itemId: ${itemId}`);
        }
      }

      await logSyncEvent({
        type: "webhook_received",
        topic,
        details: `Item sold: ${itemId} (qty: ${quantity})`,
        status: "processed",
        itemId,
      });
      break;
    }

    // Listing ended
    case "ITEM_ENDED":
    case "ITEM_CLOSED": {
      const itemId = data?.itemId || data?.legacyItemId || data?.ItemID || "";

      if (itemId) {
        const inv = await findInventoryByListingId("ebay", itemId);
        if (inv) {
          await recordDelist(inv.cardId, "ebay", itemId);
          console.log(`[eBay Webhooks] Recorded delist: ${inv.cardName} (${itemId})`);
        }
      }

      await logSyncEvent({
        type: "webhook_received",
        topic,
        details: `Item ended: ${itemId}`,
        status: "processed",
        itemId,
      });
      break;
    }

    // Item revised (price change, quantity change, etc.)
    case "ITEM_REVISED": {
      const itemId = data?.itemId || data?.legacyItemId || data?.ItemID || "";
      const newPrice = data?.currentPrice?.value || data?.price?.value;

      if (itemId && newPrice) {
        const inv = await findInventoryByListingId("ebay", itemId);
        if (inv) {
          await recordReprice(inv.cardId, "ebay", itemId, Number(newPrice));
          console.log(`[eBay Webhooks] Recorded reprice: ${inv.cardName} → $${newPrice}`);
        }
      }

      await logSyncEvent({
        type: "webhook_received",
        topic,
        details: `Item revised: ${itemId}${newPrice ? ` (new price: $${newPrice})` : ""}`,
        status: "processed",
        itemId,
      });
      break;
    }

    default:
      console.log(`[eBay Webhooks] Unhandled topic: ${topic}`);
      await logSyncEvent({
        type: "webhook_received",
        topic,
        details: `Unhandled notification type: ${topic}`,
        status: "skipped",
      });
  }
}

// ---------------------------------------------------------------------------
// eBay digital signature verification
// ---------------------------------------------------------------------------
// The x-ebay-signature header is a base64-encoded JSON:
//   { "alg": "ecdsa", "kid": "<keyId>", "signature": "<base64>", "digest": "<base64>" }
//
// Verification steps:
//   1. Decode the header to get kid, signature, and digest
//   2. Verify the digest matches SHA-256 of the raw body
//   3. Fetch the public key from eBay using the kid
//   4. Verify the signature over the digest using the public key

interface EbaySignatureHeader {
  alg?: string;
  kid: string;
  signature: string;
  digest: string;
}

async function verifyEbaySignature(
  signatureHeader: string,
  rawBody: string
): Promise<boolean> {
  try {
    // Step 1: Parse the x-ebay-signature header
    const decoded = Buffer.from(signatureHeader, "base64").toString("utf-8");
    const sigData: EbaySignatureHeader = JSON.parse(decoded);

    if (!sigData.kid || !sigData.signature || !sigData.digest) {
      console.error("[eBay Sig] Missing fields in signature header");
      return false;
    }

    // Step 2: Verify the payload digest
    const computedDigest = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("base64");

    if (computedDigest !== sigData.digest) {
      console.error("[eBay Sig] Digest mismatch — payload may have been tampered with");
      return false;
    }

    // Step 3: Fetch the public key
    const publicKey = await fetchEbayPublicKey(sigData.kid);
    if (!publicKey) {
      console.error(`[eBay Sig] Could not fetch public key for kid: ${sigData.kid}`);
      return false;
    }

    // Step 4: Verify the signature over the digest
    const signatureBuffer = Buffer.from(sigData.signature, "base64");
    const digestBuffer = Buffer.from(sigData.digest, "base64");

    const verifier = crypto.createVerify("SHA256");
    verifier.update(digestBuffer);
    const isValid = verifier.verify(publicKey, signatureBuffer);

    if (!isValid) {
      console.error("[eBay Sig] Signature verification failed");
    }

    return isValid;
  } catch (err) {
    console.error("[eBay Sig] Verification error:", err);
    return false;
  }
}

async function fetchEbayPublicKey(kid: string): Promise<string | null> {
  // Check cache first
  const cached = publicKeyCache.get(kid);
  if (cached && Date.now() - cached.fetchedAt < KEY_CACHE_TTL_MS) {
    return cached.key;
  }

  try {
    // eBay's public key endpoint
    const baseUrl = process.env.EBAY_ENVIRONMENT === "production"
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com";

    const response = await fetch(
      `${baseUrl}/commerce/notification/v1/public_key/${kid}`,
      {
        headers: {
          "Content-Type": "application/json",
          // This endpoint is public — no auth needed
        },
      }
    );

    if (!response.ok) {
      console.error(`[eBay Sig] Failed to fetch public key: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const pem = data.key;

    if (!pem) {
      console.error("[eBay Sig] No key in response");
      return null;
    }

    // Cache the key
    publicKeyCache.set(kid, { key: pem, fetchedAt: Date.now() });
    return pem;
  } catch (err) {
    console.error("[eBay Sig] Failed to fetch public key:", err);
    return null;
  }
}
