// Supabase middleware helper — refreshes the auth session on every request
// so server components always have a valid token.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Hardened cookie defaults — applied to every auth cookie Supabase sets
const COOKIE_SECURITY_OPTIONS = {
  httpOnly: true,      // Not accessible via JS — XSS protection
  secure: process.env.NODE_ENV === "production", // HTTPS-only in prod
  sameSite: "lax" as const, // CSRF protection — cookies sent on top-level navigations
  path: "/",
};

// extraRequestHeaders are forwarded to route handlers so they can read tracing info
// (e.g. x-request-id) without needing a separate mechanism.
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>
) {
  // Merge any extra headers we want route handlers to receive
  const forwardHeaders = new Headers(request.headers);
  if (extraRequestHeaders) {
    for (const [k, v] of Object.entries(extraRequestHeaders)) {
      forwardHeaders.set(k, v);
    }
  }

  let supabaseResponse = NextResponse.next({ request: { headers: forwardHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: forwardHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...COOKIE_SECURITY_OPTIONS,
              ...options,
            })
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT run any logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicPaths = ["/", "/login", "/signup", "/auth", "/terms", "/privacy", "/acceptable-use"];
  const isPublic = publicPaths.some(
    (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + "/")
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Block unverified email users from accessing the app
  if (user && !isPublic && !user.email_confirmed_at) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("verify", "true");
    url.searchParams.set("email", user.email || "");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
