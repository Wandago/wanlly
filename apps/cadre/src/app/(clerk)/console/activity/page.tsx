import { sql } from "drizzle-orm";
import { withOrg } from "@/db/client";
import { ActivityList } from "@/components/console/OverviewView";
import { Icon } from "@/components/Icon";
import { listActivity } from "@/lib/overview";
import { getShop } from "@/lib/shop";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const shop = await getShop();
  const { rows, check } = await withOrg(shop.orgId, async (db) => {
    const rows = await listActivity(db, shop.orgId, 200);
    const result = await db.execute<{ checked: string; first_bad_seq: string | null }>(
      sql`select checked, first_bad_seq from audit_log_verify()`,
    );
    return { rows, check: result.rows[0] };
  });
  const intact = check.first_bad_seq === null;

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <span className="eyebrow">Console</span>
        <h1 className="font-display text-[32px] font-semibold leading-9 tracking-[-0.025em]">Activity</h1>
        <p className="max-w-[640px] text-muted">
          Everything you and your cadre have done, newest first. Entries can&apos;t be edited or removed.
        </p>
      </header>
      <p
        className={`flex items-center gap-2 text-sm font-semibold ${intact ? "text-good" : "text-bad"}`}
        role="status"
      >
        <Icon name={intact ? "check" : "lock"} />
        {intact
          ? `Log intact: all ${check.checked} entries check out.`
          : `Log broken at entry ${check.first_bad_seq}. Contact Wanlly support.`}
      </p>
      <ActivityList rows={rows} />
    </>
  );
}
