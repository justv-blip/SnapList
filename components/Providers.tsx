"use client";

import { ErrorBoundary } from "./ErrorBoundary";
import { ToastProvider } from "./Toast";
import { ThemeProvider } from "@/lib/theme";

/**
 * Client-side providers wrapping the entire app.
 * Add new providers here (e.g. Stripe Elements, theme, etc.)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
