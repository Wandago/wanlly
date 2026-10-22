import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { sql } from "drizzle-orm";
import { ensureOrg, findOrgId, withOrg } from "@/db/client";
import { agentSettings, auditLog, events, integrations, orgs } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { admin, adminUrl, appUrl, resetDatabase } from "./test-db";

const run = adminUrl ? describe : describe.skip;

/** The Postgres error behind a failed query (Drizzle wraps it). */
async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    const e = err as { cause?: { message?: string }; message: string };
    return e.cause?.message ?? e.message;
  }
  throw new Error("expected the query to fail");
}

run("database security", () => {
  let shopA: string;
  let shopB: string;
  let url: string;

  beforeAll(async () => {
    await resetDatabase();
    url = appUrl();
    shopA = await ensureOrg({ clerkOrgId: "org_a", name: "Shop A", actorId: "user_a" }, url);
    shopB = await ensureOrg({ clerkOrgId: "org_b", name: "Shop B", actorId: "user_b" }, url);
  });

  it("only shows the current shop's rows", async () => {
    const rows = await withOrg(shopA, (db) => db.select({ id: orgs.id }).from(orgs), url);
    expect(rows).toEqual([{ id: shopA }]);
    const agents = await withOrg(shopA, (db) => db.select().from(agentSettings), url);
    expect(agents).toHaveLength(7);
    expect(agents.every((a) => a.orgId === shopA)).toBe(true);
  });

  it("shows nothing when no shop is set", async () => {
    const app = new pg.Client({ connectionString: url });
    await app.connect();
    try {
      expect((await app.query("select id from orgs")).rows).toEqual([]);
    } finally {
      await app.end();
    }
  });

  it("refuses to write another shop's rows", async () => {
    expect(
      await pgError(withOrg(shopA, (db) => db.insert(integrations).values({ orgId: shopB, kind: "sms_forward" }), url)),
    ).toMatch(/row-level security/);
  });

  it("can't change another shop even with a matching where clause", async () => {
    const changed = await withOrg(
      shopA,
      (db) => db.update(agentSettings).set({ enabled: false }).where(sql`org_id = ${shopB}`).returning(),
      url,
    );
    expect(changed).toEqual([]);
  });

  it("finds shops without creating them", async () => {
    expect(await findOrgId("org_a", url)).toBe(shopA);
    expect(await findOrgId("org_missing", url)).toBeNull();
  });

  it("creates a shop once, even when asked at the same time", async () => {
    const ids = await Promise.all(
      Array.from({ length: 6 }, () => ensureOrg({ clerkOrgId: "org_race", name: "Race", actorId: "u" }, url)),
    );
    expect(new Set(ids).size).toBe(1);
    const created = await withOrg(ids[0], (db) => db.select().from(auditLog), url);
    expect(created.map((r) => r.action)).toEqual(["shop.created"]);
  });

  it("turns on Chief, Finance and Inbox by default", async () => {
    const on = await withOrg(shopA, (db) => db.select().from(agentSettings), url);
    expect(on.filter((a) => a.enabled).map((a) => a.agent).sort()).toEqual(["chief", "finance", "inbox"]);
  });

  it("stores each event once", async () => {
    const add = () =>
      withOrg(
        shopA,
        (db) =>
          db
            .insert(events)
            .values({ orgId: shopA, type: "payment.received", source: "sms_forward", sourceRef: "SJM4K2XQ7P" })
            .onConflictDoNothing()
            .returning({ id: events.id }),
        url,
      );
    expect(await add()).toHaveLength(1);
    expect(await add()).toHaveLength(0);
  });
});

run("audit log", () => {
  let shop: string;
  let url: string;

  beforeAll(async () => {
    await resetDatabase();
    url = appUrl();
    shop = await ensureOrg({ clerkOrgId: "org_audit", name: "Audit shop", actorId: "user" }, url);
  });

  const verify = (orgId: string) =>
    withOrg(
      orgId,
      async (db) =>
        (await db.execute<{ checked: string; first_bad_seq: string | null }>(sql`select * from audit_log_verify()`))
          .rows[0],
      url,
    );

  it("chains entries in order, even when written at the same time", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        withOrg(shop, (db) => recordAudit(db, shop, { actorType: "member", actorId: "user", action: "test", data: { i } }), url),
      ),
    );
    const rows = await withOrg(shop, (db) => db.select().from(auditLog).orderBy(auditLog.seq), url);
    expect(rows.map((r) => r.seq)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(rows[0].prevHash).toBeNull();
    for (let i = 1; i < rows.length; i++) expect(rows[i].prevHash).toBe(rows[i - 1].hash);
    expect(await verify(shop)).toEqual({ checked: "21", first_bad_seq: null });
  });

  it("ignores a seq or hash the app tries to set", async () => {
    await withOrg(
      shop,
      (db) => db.insert(auditLog).values({ orgId: shop, actorType: "system", action: "forged", seq: 1, hash: "x" }),
      url,
    );
    expect(await verify(shop)).toEqual({ checked: "22", first_bad_seq: null });
  });

  it("can't be edited or deleted by the app", async () => {
    expect(await pgError(withOrg(shop, (db) => db.update(auditLog).set({ action: "edited" }), url))).toMatch(
      /permission denied/,
    );
    expect(await pgError(withOrg(shop, (db) => db.delete(auditLog), url))).toMatch(/permission denied/);
  });

  it("can't be edited by the database owner either", async () => {
    await expect(admin((c) => c.query("update audit_log set action = 'edited' where seq = 2"))).rejects.toThrow(
      /append-only/,
    );
  });

  it("shows where someone tampered with it", async () => {
    await admin(async (c) => {
      await c.query("alter table audit_log disable trigger audit_log_append_only");
      await c.query("update audit_log set data = '{\"i\": 999}' where org_id = $1 and seq = 5", [shop]);
      await c.query("alter table audit_log enable trigger audit_log_append_only");
    });
    expect(await verify(shop)).toEqual({ checked: "5", first_bad_seq: "5" });
  });
});
