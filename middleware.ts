import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/rateLimit";

// Rate limit configs
const AUTH_RATE_LIMIT = { id: "auth", limit: 10, windowSec: 60 };  // 10 attempts/min per IP
const API_RATE_LIMIT  = { id: "api",  limit: 30, windowSec: 60 };  // 30 req/min per IP (general)
const SCAN_RATE_LIMIT = { id: "scan", limit: 12, windowSec: 60 };  // 12 req/min per IP (scan endpoint)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Unique ID for tracing this request through logs and client error reports.
  // Set as a response header (X-Request-Id) and forwarded to route handlers
  // as a request header (x-request-id) so logs on both ends share the same ID.
  const requestId = crypto.randomUUID();

  // ── Rate-limit auth endpoints ──
  if (
    pathname === "/login" ||
    pathname.startsWith("/auth/")
  ) {
    if (request.method === "POST") {
      const result = checkRateLimit(AUTH_RATE_LIMIT, ip);
      if (!result.allowed) {
        return NextResponse.json(
          { error: "Too many login attempts. Please wait and try again." },
          {
            status: 429,
            headers: {
              "Retry-After": String(result.retryAfterSec || 60),
              "X-Request-Id": requestId,
            },
          }
        );
      }
    }
  }

  // ── Tighter rate limit on the scan endpoint ──
  if (pathname === "/api/scan") {
    const result = checkRateLimit(SCAN_RATE_LIMIT, ip);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many scan requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSec || 60),
            "X-Request-Id": requestId,
          },
        }
      );
    }
  }

  // ── General rate-limit for all other API routes ──
  if (pathname.startsWith("/api/") && pathname !== "/api/scan") {
    const result = checkRateLimit(API_RATE_LIMIT, ip);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSec || 60),
            "X-Request-Id": requestId,
          },
        }
      );
    }
  }

  // ── Session refresh — forward requestId to route handlers ──
  const response = await updateSession(request, { "x-request-id": requestId });

  // Attach request ID to the response so clients can reference it
  response.headers.set("X-Request-Id", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
