// POST /api/scan
// Body: multipart/form-data with one or more "images" files.
// For each image:
//   1. Run Claude vision identification (if ANTHROPIC_API_KEY is set).
//   2. If vision is confident enough, look up in the real TCG API.
//   3. Otherwise return needsManualEntry so the UI prompts the user.

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { identifyCard, isVisionEnabled, type ScanHints } from "@/lib/vision";
import { lookupCard } from "@/lib/tcgApis";
import type { ScanResult, VisionGuess } from "@/lib/types";
import { requireAuth, checkScanLimit, commitScanUsage, AuthError, authErrorResponse } from "@/lib/supabase/api-auth";
import { MAX_PAYLOAD } from "@/lib/validation";
import { logger } from "@/lib/logger";

// Max dimension for images sent to vision (pixels).
// 1024px is plenty for card identification and keeps the payload small.
const MAX_IMAGE_DIMENSION = 1024;
const JPEG_QUALITY = 80;

export const runtime = "nodejs";
export const maxDuration = 60;

const CONFIDENCE_THRESHOLD = 0.45;

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withContext({ requestId });

  // ── Auth & rate limiting ──
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No images provided" }, { status: 400 });
  }

  // ── Input validation ──
  if (files.length > MAX_PAYLOAD.scanBatch) {
    return NextResponse.json(
      { error: `Too many images. Maximum ${MAX_PAYLOAD.scanBatch} per request.` },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_PAYLOAD.scanImage) {
      return NextResponse.json(
        { error: `Image too large (${Math.round(file.size / 1024 / 1024)}MB). Max 10MB.` },
        { status: 400 }
      );
    }
  }

  // Check scan limits before processing
  try {
    const { remaining } = await checkScanLimit(auth.supabase, auth.profile, files.length);
    log.info("scan request", { userId: auth.user.id, images: files.length, remaining });
  } catch (err) {
    return authErrorResponse(err);
  }

  // Parse optional scan hints from the active profile (sent as a JSON string field).
  let hints: ScanHints | undefined;
  const hintsRaw = form.get("hints");
  if (hintsRaw && typeof hintsRaw === "string") {
    try { hints = JSON.parse(hintsRaw); } catch { /* ignore bad JSON */ }
  }

  const results: ScanResult[] = await Promise.all(
    files.map(async (file) => {
      try {
        return await scanOne(file, hints);
      } catch (err: any) {
        log.error("scan image failed", { message: err?.message });
        return {
          needsManualEntry: true,
          note: `Scan failed: ${err?.message || "unknown error"}`,
          _failed: true, // internal flag — not sent to client
        } as ScanResult & { _failed?: boolean };
      }
    })
  );

  // Only count successful scans against the user's quota
  const successCount = results.filter((r) => !(r as any)._failed).length;
  if (successCount > 0) {
    try {
      await commitScanUsage(auth.supabase, auth.profile, successCount);
    } catch (err: any) {
      log.error("failed to commit scan usage", { userId: auth.user.id, message: err?.message });
      // Don't fail the request — scans already completed
    }
  }

  // Strip internal flags before sending to client
  const cleanResults = results.map(({ ...r }) => {
    delete (r as any)._failed;
    return r;
  });

  return NextResponse.json(
    { visionEnabled: isVisionEnabled(), results: cleanResults },
    { headers: { "X-Request-Id": requestId } }
  );
}

async function scanOne(file: File, hints?: ScanHints): Promise<ScanResult> {
  // If vision is disabled, skip straight to manual-entry.
  if (!isVisionEnabled()) {
    return {
      needsManualEntry: true,
      note: "Vision is disabled (no ANTHROPIC_API_KEY). Enter the card name manually."
    };
  }

  const rawBuf = Buffer.from(await file.arrayBuffer());

  // Resize large images to keep API payloads small and fast.
  // iPhone photos are typically 3-4MB; this brings them under 200KB.
  const resized = await sharp(rawBuf)
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const base64 = resized.toString("base64");
  const mediaType = "image/jpeg" as const;
  logger.debug("image resized", { originalKb: Math.round(rawBuf.length / 1024), resizedKb: Math.round(resized.length / 1024) });

  let guess: VisionGuess;
  try {
    guess = await identifyCard({ base64, mediaType, hints });
  } catch (err: any) {
    return {
      needsManualEntry: true,
      note: `Vision error: ${err?.message || "unknown"}. Enter card name manually.`
    };
  }

  // Card back detected — don't create a card entry, just flag it
  if (guess.isCardBack) {
    return {
      visionGuess: guess,
      needsManualEntry: false,
      isCardBack: true,
      note: "Card back detected — will be paired with the front photo."
    };
  }

  // Low confidence? Let the user type it.
  if (!guess.game || !guess.name || guess.confidence < CONFIDENCE_THRESHOLD) {
    return {
      visionGuess: guess,
      needsManualEntry: true,
      note: guess.reasoning || "Low confidence from vision — please confirm."
    };
  }

  // Try to enrich with a real lookup.
  const hit = await lookupCard({
    game: guess.game,
    name: guess.name,
    setName: guess.setName || undefined,
    setCode: guess.setCode || undefined,
    collectorNumber: guess.collectorNumber || undefined
  });

  if (hit) {
    return {
      visionGuess: guess,
      matchedCard: hit,
      needsManualEntry: false
    };
  }

  // Vision was confident but the catalog lookup came up empty. Offer confirmation.
  return {
    visionGuess: guess,
    matchedCard: { name: guess.name, game: guess.game },
    needsManualEntry: true,
    note: "Vision identified the card but catalog lookup was empty. Confirm details."
  };
}
