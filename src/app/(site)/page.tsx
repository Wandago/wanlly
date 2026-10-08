import type { Metadata } from "next";
import { Landing } from "@/components/site/landing";

export const metadata: Metadata = {
  title: "Wanlly · Frontier AI for everyone with an idea",
  description: "Chat, code and design with Claude and Gemini. No card, no subscription: one short video a day unlocks your floor, wherever you live.",
};

export default function Home() {
  return <Landing />;
}
