import type { Metadata } from "next";
import { BuilderView } from "@/components/build/builder-view";

export const metadata: Metadata = { title: "Builder · Wanlly" };

export default async function BuildProjectPage({ params }: PageProps<"/build/[id]">) {
  const { id } = await params;
  return <BuilderView id={Number(id)} />;
}
