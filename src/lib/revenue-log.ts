import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/*
 * Income recorded by hand: affiliate commissions, sponsorship payments, network payouts that
 * have no API. Kept in app_flags ("revenue_entries") so it needs no table of its own.
 */

export type RevenueEntry = { id: string; day: string; source: string; usd: number; note: string };

const KEY = "revenue_entries";

export async function readEntries(): Promise<RevenueEntry[]> {
  try {
    const [row] = await db().select({ value: schema.appFlags.value }).from(schema.appFlags).where(eq(schema.appFlags.key, KEY)).limit(1);
    return Array.isArray(row?.value) ? (row.value as RevenueEntry[]) : [];
  } catch {
    return [];
  }
}

export async function writeEntries(entries: RevenueEntry[], by: string) {
  const value = entries.slice(-500);
  await db()
    .insert(schema.appFlags)
    .values({ key: KEY, value, updatedBy: by })
    .onConflictDoUpdate({ target: schema.appFlags.key, set: { value, updatedBy: by, updatedAt: sql`now()` } });
}

export function cleanEntry(v: unknown): RevenueEntry | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const day = typeof o.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : null;
  const usd = Math.round(Number(o.usd) * 100) / 100;
  const source = typeof o.source === "string" ? o.source.trim().slice(0, 40) : "";
  if (!day || !source || !Number.isFinite(usd) || usd <= 0 || usd > 1_000_000) return null;
  return { id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, day, source, usd, note: typeof o.note === "string" ? o.note.trim().slice(0, 140) : "" };
}
