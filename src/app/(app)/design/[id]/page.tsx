import type { Metadata } from "next";
import { DesignEditor } from "@/components/design-editor";

export const metadata: Metadata = { title: "Design · Wanlly" };

export default async function DesignPage({ params }: PageProps<"/design/[id]">) {
  const { id } = await params;
  return <DesignEditor key={id} id={Number(id) || 0} />;
}
