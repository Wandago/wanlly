import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Coworkers · Wanlly" };

// The coworkers design (components/pages/coworkers-view.tsx) returns once agents can run them.
export default function CoworkersPage() {
  return (
    <ComingSoon
      icon="users"
      title="AI coworkers that keep working while you're away"
      text="Give a coworker a job, like testing your app, writing posts or watching your inbox, and it works on a schedule inside your projects."
      points={["Pick a role, a model and a schedule", "Connect the tools it may use, like GitHub or Google Drive", "Set a credit limit so it never spends more than you allow"]}
    />
  );
}
