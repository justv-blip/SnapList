import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Capture 10% of transactions for performance monitoring (adjust as needed)
    tracesSampleRate: 0.1,
    // Capture 100% of sessions with errors
    replaysOnErrorSampleRate: 1.0,
    // Capture 1% of all sessions for session replay
    replaysSessionSampleRate: 0.01,
    integrations: [
      Sentry.replayIntegration(),
    ],
  });
}
