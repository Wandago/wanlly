import { UserButton } from "@clerk/nextjs";
import { eq } from "drizzle-orm";
import { withOrg } from "@/db/client";
import { orgs } from "@/db/schema";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { getShop } from "@/lib/shop";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const shop = await getShop();
  const [org] = await withOrg(shop.orgId, (db) =>
    db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, shop.orgId)),
  );
  return (
    <ConsoleShell shopName={org.name} account={<UserButton />}>
      {children}
    </ConsoleShell>
  );
}
