// POST /api/scan-sealed
// Body: multipart/form-data with one "image" file.
//
// Pipeline:
//   1. Validate image + auth + scan limit
//   2. Resize image (same as card scan)
//   3. Run sealed-product vision identification
//   4. Look up market price via eBay Finding API
//   5. Return structured SealedScanResult
//
// Sealed scans consume scan quota the same way card scans do.

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { identifySealedProduct } from "@/lib/sealedVision";
import { getSealedProductPrice } from "@/lib/sealedPricing";
import { requireAuth, checkScanLimit, commitScanUsage, authErrorResponse } from "@/lib/supabase/api-auth";
import { MAX_PAYLOAD } from "@/lib/validation";
import { logger } from "@/lib/logger";
import type { SealedScanResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_IMAGE_DIMENSION = 1024;
const JPEG_QUALITY = 80;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withContext({ requestId });

  // ── Auth ──
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  // ── Parse form ──
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  if (file.size > MAX_PAYLOAD.scanImage) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 });
  }

  // ── Scan limit ──
  let creditsNeeded = 0;
  let rolloverUsed = 0;
  try {
    const limitCheck = await checkScanLimit(auth.supabase, auth.profile, 1);
    creditsNeeded = limitCheck.creditsNeeded;
    rolloverUsed  = limitCheck.rolloverUsed;
    log.info("scan-sealed request", { userId: auth.user.id });
  } catch (err) {
    return authErrorResponse(err);
  }

  // ── Resize image ──
  let imageBase64: string;
  let mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    imageBase64 = resized.toString("base64");
  } catch {
    return NextResponse.json({ error: "Failed to process image" }, { status: 422 });
  }

  // ── Vision identification ──
  let guess;
  try {
    guess = await identifySealedProduct(imageBase64, mediaType);
  } catch (err: unknown) {
    log.error("sealed vision error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Vision identification failed" }, { status: 502 });
  }

  // ── Price lookup (non-blocking — don't fail if eBay is unavailable) ──
  let priceData = null;
  if (guess.productName && guess.confidence >= 0.5) {
    try {
      priceData = await getSealedProductPrice(guess.productName, guess.game);
    } catch {
      // Non-critical — UI shows manual entry fallback
    }
  }

  // ── Commit scan usage ──
  await commitScanUsage(auth.supabase, auth.profile, 1, creditsNeeded, rolloverUsed);

  const result: SealedScanResult = {
    id: uuid(),
    guess,
    marketPriceUsd: priceData?.marketPriceUsd,
    priceSource: priceData?.priceSource,
    priceSampleSize: priceData?.sampleSize,
    condition: "sealed",
  };

  log.info("scan-sealed complete", {
    userId: auth.user.id,
    product: guess.productName,
    confidence: guess.confidence,
    price: priceData?.marketPriceUsd,
  });

  return NextResponse.json({ result });
}
