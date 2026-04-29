import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Security headers ──────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HTTPS enforcement — tell browsers to always use HTTPS for 1 year
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Prevent clickjacking — block embedding in iframes
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing attacks
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer data leaked to external sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features we don't use
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), usb=(), payment=(self)",
          },
          // Content Security Policy — restrict script/style/image sources
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Images: self + Supabase Storage + TCG card-image CDNs
              "img-src 'self' data: blob: https://*.supabase.co https://images.pokemontcg.io https://cards.scryfall.io https://images.ygoprodeck.com https://*.cloudfront.net https://images.digimoncard.io https://lorcast.com https://*.lorcast.com https://optcgapi.com https://*.optcgapi.com",
              // API calls: self + Supabase + Anthropic + Sentry
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://*.sentry.io https://o*.ingest.sentry.io",
              "font-src 'self'",
              "object-src 'none'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },

  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = "cheap-module-source-map";
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pokemontcg.io" },
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "images.ygoprodeck.com" },
      { protocol: "https", hostname: "*.cloudfront.net" }
    ]
  },
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"]
  }
};

// Sentry wraps the config to instrument server/edge/client bundles.
// When NEXT_PUBLIC_SENTRY_DSN is not set, Sentry does nothing at runtime.
export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during builds
  silent: !process.env.CI,
  // Source map upload requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars.
  // Without them, Sentry skips upload silently — no build failure.
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  // Automatically tree-shake Sentry logger statements in production
  automaticVercelMonitors: false,
});
