import { eq } from "drizzle-orm";
import { withOrg } from "@/db/client";
import { orgs } from "@/db/schema";
import { canChangeSettings } from "@/lib/roles";
import { getShop } from "@/lib/shop";
import { ShopForm } from "./ShopForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const shop = await getShop();
  const [org] = await withOrg(shop.orgId, (db) =>
    db.select({ name: orgs.name, town: orgs.town }).from(orgs).where(eq(orgs.id, shop.orgId)),
  );
  return (
    <>
      <header className="flex flex-col gap-1.5">
        <span className="eyebrow">Console</span>
        <h1 className="font-display text-[32px] font-semibold leading-9 tracking-[-0.025em]">Shop details</h1>
        <p className="max-w-[640px] text-muted">Your cadre uses these in messages and reports.</p>
      </header>
      <ShopForm name={org.name} town={org.town ?? ""} canEdit={canChangeSettings(shop.role)} />
    </>
  );
}
