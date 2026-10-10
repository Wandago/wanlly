import type { Metadata } from "next";
import { CampaignManager } from "@/components/site/campaign-manager";

export const metadata: Metadata = { title: "Your campaign · Wanlly", robots: { index: false, follow: false } };

export default async function ManageCampaign({ params }: { params: Promise<{ ref: string }> }) {
  return <CampaignManager reference={(await params).ref} />;
}
