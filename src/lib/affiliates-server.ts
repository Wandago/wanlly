import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanAffiliates, type Affiliate } from "./affiliates";

/** The affiliate list from app_flags ("affiliates"); empty when none are set. */
export async function loadAffiliates(): Promise<Affiliate[]> {
  try {
    const [row] = await db().select({ value: schema.appFlags.value }).from(schema.appFlags).where(eq(schema.appFlags.key, "affiliates")).limit(1);
    return row ? cleanAffiliates(row.value) : [];
  } catch {
    return [];
  }
}
