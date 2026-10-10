import type { Metadata } from "next";
import { Landing } from "@/components/site/landing";

export const metadata: Metadata = {
  title: "Wanlly · Frontier AI for everyone with an idea",
  description: "Chat, code and design with the world's top AI models. No card, no subscription: watch short sponsor videos, earn credits, build.",
};

export default function Home() {
  return <Landing />;
}
