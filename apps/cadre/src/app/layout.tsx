import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cadre", template: "%s · Cadre" },
  description: "A team of AI agents that keeps your shop moving, on WhatsApp. By Wanlly.",
};

// Cadre is dark-first: ink surfaces with one tangerine signal.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen bg-paper text-ink">{children}</body>
    </html>
  );
}
