import type { Metadata } from "next";
import { ProjectsView } from "@/components/pages/projects-view";

export const metadata: Metadata = { title: "Projects · Wanlly" };

export default function ProjectsPage() {
  return <ProjectsView />;
}
