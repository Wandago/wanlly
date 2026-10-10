import type { Metadata } from "next";
import { BuilderHome } from "@/components/build/builder-home";

export const metadata: Metadata = { title: "Builder · Wanlly" };

export default function BuildPage() {
  return <BuilderHome />;
}
