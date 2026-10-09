import type { Metadata } from "next";
import { AdvertisePage } from "@/components/site/advertise-page";

export const metadata: Metadata = {
  title: "Advertise · Wanlly",
  description: "Reach students and young creators while they build. Sponsor cards, banners, videos, pop-up cards and trials in Wanlly's free AI workspace.",
};

export default function Advertise() {
  return <AdvertisePage />;
}
