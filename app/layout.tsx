import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SnapList",
  description:
    "Snap a photo, get a listing. AI-powered card scanning and listing for TCG sellers.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SnapList",
  },
};

export const viewport: Viewport = {
  themeColor: "#5cd4a0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-accent="green" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=localStorage.getItem('tcg-theme-mode');var a=localStorage.getItem('tcg-theme-accent');if(m)document.documentElement.setAttribute('data-theme',m);if(a)document.documentElement.setAttribute('data-accent',a);}catch(e){}})()` }} />
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
