import "server-only";
import { rawSql } from "@/db";
import type { NetworkConfig } from "./ad-network";
import { adsterraDaily } from "./adsterra";
import { readEntries } from "./revenue-log";

/*
 * Which network gets a slot. Paste-code networks don't bid in real time, so they're ranked by
 * what each one really pays per 1,000 views over the last 14 days: Adsterra from its own report,
 * the others from income recorded in Admin → Money (source naming the network) divided by the
 * views Wanlly counted. Until a network has 1,000 views measured, the team's estimate stands in.
 */

export type NetworkRank = { name: string; estimate: number | null; measured: number | null; views: number; earned: number; ecpm: number };

const DAYS = 14;
const MIN_VIEWS = 1000;
let cache: { key: string; at: number; ranks: NetworkRank[] } | null = null;

export async function rankNetworks(list: NetworkConfig[]): Promise<NetworkRank[]> {
  const key = list.map((n) => `${n.name}:${n.ecpm ?? ""}`).join("|");
  if (cache?.key === key && Date.now() - cache.at < 15 * 60_000) return cache.ranks;
  const end = new Date();
  const start = new Date(end.getTime() - (DAYS - 1) * 86_400_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const [views, adsterra, entries] = await Promise.all([
    rawSql()`select partner, count(*)::int as n from ad_events where kind = 'impression' and created_at >= now() - ${`${DAYS} days`}::interval group by partner`.catch(() => []) as Promise<{ partner: string; n: number }[]>,
    list.some((n) => n.name.includes("adsterra")) ? adsterraDaily(day(start), day(end)) : Promise.resolve(null),
    readEntries(),
  ]);
  const counted = new Map(views.map((v) => [v.partner, Number(v.n)]));
  const since = day(start);
  const ranks = list.map((n) => {
    let seen = counted.get(n.name) ?? 0;
    let earned = entries.filter((e) => e.day >= since && e.source.toLowerCase().includes(n.name)).reduce((a, e) => a + e.usd, 0);
    if (n.name.includes("adsterra") && adsterra?.days.length) {
      seen = adsterra.days.reduce((a, d) => a + d.impressions, 0);
      earned += adsterra.days.reduce((a, d) => a + d.usd, 0);
    }
    const measured = seen >= MIN_VIEWS ? (earned / seen) * 1000 : null;
    const estimate = n.ecpm ?? null;
    return { name: n.name, estimate, measured, views: seen, earned, ecpm: measured ?? estimate ?? 0 };
  });
  cache = { key, at: Date.now(), ranks };
  return ranks;
}

/**
 * Networks in the order they should get slots, best-paying first. One page load in ten puts a
 * random other network first, so every network keeps getting enough views to be measured.
 */
export function slotOrder<T extends { name: string }>(networks: T[], ranks: NetworkRank[], explore = Math.random() < 0.1): T[] {
  const rate = new Map(ranks.map((r) => [r.name, r.ecpm]));
  const sorted = [...networks].sort((a, b) => (rate.get(b.name) ?? 0) - (rate.get(a.name) ?? 0));
  if (explore && sorted.length > 1) {
    const i = 1 + Math.floor(Math.random() * (sorted.length - 1));
    sorted.unshift(...sorted.splice(i, 1));
  }
  return sorted;
}
