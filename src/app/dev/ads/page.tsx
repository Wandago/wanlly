import type { Metadata } from "next";
import { AdGallery } from "@/components/ads/ad-gallery";

export const metadata: Metadata = {
  title: "Ad formats · Wanlly",
  robots: { index: false },
};

export default function AdFormatsPage() {
  return <AdGallery />;
}
