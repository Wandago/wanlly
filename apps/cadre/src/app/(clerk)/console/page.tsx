import { withOrg } from "@/db/client";
import { OverviewView } from "@/components/console/OverviewView";
import { loadOverview } from "@/lib/overview";
import { canChangeSettings } from "@/lib/roles";
import { getShop } from "@/lib/shop";
import { setAgentEnabled } from "./actions";

export const metadata = { title: "Console" };

export default async function ConsolePage() {
  const shop = await getShop();
  const overview = await withOrg(shop.orgId, (db) => loadOverview(db, shop.orgId, shop.clerkUserId));
  return (
    <OverviewView
      overview={overview}
      toggleAgent={setAgentEnabled}
      canEdit={canChangeSettings(shop.role)}
      activityHref="/console/activity"
    />
  );
}
