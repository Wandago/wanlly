import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Wanlly",
  description: "Free AI for chat, code, design and images, supported by sponsors you choose to see.",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="h-full">
        <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
