import type { Metadata } from "next";
import { BetaPage } from "@/components/beta/beta-page";

export const metadata: Metadata = {
  title: "Wanlly · Private beta",
  description: "Frontier AI, paid for by ads. Chat, code and design with Claude, Gemini and more. Apply for the beta.",
};

export default function Beta() {
  return <BetaPage />;
}
