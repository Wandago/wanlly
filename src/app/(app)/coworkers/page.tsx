import type { Metadata } from "next";
import { CoworkersView } from "@/components/pages/coworkers-view";

export const metadata: Metadata = { title: "Coworkers · Wanlly" };

export default function CoworkersPage() {
  return <CoworkersView />;
}
