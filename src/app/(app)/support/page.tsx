import type { Metadata } from "next";
import { SupportView } from "@/components/pages/support-view";

export const metadata: Metadata = { title: "Help and support · Wanlly" };

export default function SupportPage() {
  return <SupportView />;
}
