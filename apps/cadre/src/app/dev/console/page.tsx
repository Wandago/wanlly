import { notFound } from "next/navigation";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { OverviewView } from "@/components/console/OverviewView";
import { buildAgents, buildConnections, buildSteps, type Overview } from "@/lib/overview";

// Preview of the console with sample data, for working on the UI without Clerk or a
// database. Only exists in development.
export default function DevConsolePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const now = Date.now();
  const overview: Overview = {
    shop: { name: "Njeri Hardware", town: "Nakuru" },
    steps: buildSteps({ phoneVerified: false, integrations: [] }),
    connections: buildConnections([]),
    agents: buildAgents([
      { agent: "chief", enabled: true },
      { agent: "finance", enabled: true },
      { agent: "inbox", enabled: false },
    ]),
    activity: [
      { seq: 3, at: new Date(now - 5 * 60_000).toISOString(), actor: "You", text: "turned off Inbox" },
      { seq: 2, at: new Date(now - 6 * 60_000).toISOString(), actor: "You", text: "joined the shop" },
      { seq: 1, at: new Date(now - 6 * 60_000).toISOString(), actor: "You", text: "created the shop Njeri Hardware" },
    ],
  };

  return (
    <ConsoleShell
      shopName={overview.shop.name}
      base="/dev/console"
      account={
        <span className="grid size-8 place-items-center rounded-full bg-ink text-[13px] font-semibold text-paper">WN</span>
      }
    >
      <OverviewView overview={overview} canEdit={false} activityHref="/dev/console" />
    </ConsoleShell>
  );
}
