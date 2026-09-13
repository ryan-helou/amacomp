import type { Metadata, Viewport } from "next";
import { Archivo, Public_Sans, JetBrains_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { UpdateWatcher } from "@/components/UpdateWatcher";
import { ThemeScript } from "@/components/ThemeScript";

const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// A tall, athletic scoreboard face — used for the big hero stat (the weekly ring).
const stat = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

const body = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  applicationName: "AmaComp",
  title: "AmaComp — Triathlon Standings",
  description:
    "Weekly points competition for swim, bike, run and gym. Log your kilometres, watch the lanes reshuffle.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AmaComp",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  // Next 16 emits the modern `mobile-web-app-capable`, but older iOS still keys
  // standalone launch off the legacy name — this is a home-screen app, so ship both.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#e6eef1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      /* ThemeScript stamps `data-palette` on this element before React hydrates,
         so the server's markup and the client's DOM differ here by design. */
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} ${stat.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Before anything paints, so a chosen colourway never flashes Deck first. */}
        <ThemeScript />
        {children}
        <ServiceWorker />
        <UpdateWatcher />
      </body>
    </html>
  );
}
