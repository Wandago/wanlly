import type { Metadata } from "next";
import { CampaignBuilder } from "@/components/site/campaign-builder";

export const metadata: Metadata = {
  title: "Create a campaign · Wanlly",
  description: "Build your ad, set a budget and offer a price. Reach students and young creators in Wanlly's free AI workspace.",
};

export default function CreateCampaign() {
  return <CampaignBuilder />;
}
