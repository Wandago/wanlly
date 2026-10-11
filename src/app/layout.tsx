import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { PageBeacon } from "@/components/page-beacon";
import { SITE_URL } from "@/lib/site";

/** Wanlly's Google AdSense publisher id (public: it appears in every ad request). */
const ADSENSE_CLIENT = "ca-pub-9927775455061931";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700"] });

const DESCRIPTION = "Chat, code and design with top AI models for free. No card and no subscription: watch sponsor ads, earn credits, and build.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Wanlly",
  description: DESCRIPTION,
  applicationName: "Wanlly",
  openGraph: { type: "website", siteName: "Wanlly", title: "Wanlly · Frontier AI for everyone with an idea", description: DESCRIPTION, locale: "en_KE" },
  twitter: { card: "summary_large_image", title: "Wanlly · Frontier AI for everyone with an idea", description: DESCRIPTION },
  // Ad network site verification (a label only; nothing runs).
  // Monetag site verification: wanlly.africa, and the code it gave for the ads site too.
  other: { monetag: ["ff01947e2985eff24df4cccf657afd3e", "a4afdb23dd54a039b0a0e7bf98b75c0e"], "google-adsense-account": ADSENSE_CLIENT },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#111216" },
  ],
};

/** Clerk's sign-in screens, in Wanlly's colours and type. */
const clerkAppearance = {
  variables: {
    colorPrimary: "var(--fg)",
    colorBackground: "var(--surface)",
    colorForeground: "var(--fg)",
    colorMutedForeground: "var(--muted)",
    colorInput: "var(--surface)",
    colorBorder: "var(--line)",
    colorNeutral: "var(--fg)",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "10px",
  },
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("wanlly-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies a chosen light or dark theme before first paint, so the page never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Google AdSense, on every page as AdSense asks: verifies the site and serves the ad units. */}
        <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} crossOrigin="anonymous" />
      </head>
      <body className="h-full">
        <ClerkProvider appearance={clerkAppearance}>
          {children}
          <PageBeacon />
        </ClerkProvider>
      </body>
    </html>
  );
}
