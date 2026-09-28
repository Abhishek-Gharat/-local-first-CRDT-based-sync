import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { RegisterServiceWorker } from "@/lib/offline/register-sw";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "docsync",
  description:
    "Local-first collaborative document editor. Works offline, syncs without clobbering unsynced work, and merges concurrent edits with zero data loss.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
    { media: "(prefers-color-scheme: dark)", color: "#17171c" },
  ],
};

/**
 * Root layout holds only document-level concerns: fonts, the theme provider,
 * the service-worker registration, and the tooltip provider every custom
 * surface relies on.
 *
 * Chrome is deliberately *not* here. The product has three genuinely different
 * shells — marketing, workspace, editor — and each is owned by its own route
 * group layout so a marketing header can never appear above a document.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` is required on <html>: next-themes writes the
    // `.dark` class onto this element from a pre-hydration inline script, so
    // the client DOM intentionally differs from the server's.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased font-sans`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased selection:bg-primary/15 selection:text-primary">
        <ThemeProvider>
          <RegisterServiceWorker />
          <TooltipProvider delay={200}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
