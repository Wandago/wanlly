import "server-only";
import { eq } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { adsterraDaily } from "./adsterra";
import { ESTIMATE, FLOOR_CREDITS, SPOT_REWARD } from "./catalog";
import { readEntries } from "./revenue-log";

/*
 * Credits per ad, set so ads pay for what people spend. With the "auto" rule, a finished ad
 * earns a share (70% by default) of what ads really brought in per finished ad over the last 14
 * days: sold campaigns, Adsterra's report and income recorded by hand, divided by ads finished.
 * Until 300 ads are measured, or with the "fixed" rule, the team's fixed number stands. The
 * first ad of the day is worth twice a normal one.
 */

export type RewardPolicy = { mode: "auto" | "fixed"; perAd: number; share: number };
export type RewardNow = { perAd: number; floor: number; measured: { usdPerAd: number; ads: number } | null; policy: RewardPolicy };

export const DEFAULT_POLICY: RewardPolicy = { mode: "fixed", perAd: SPOT_REWARD, share: 0.7 };
const MIN_ADS = 300;
const MIN_CREDITS = 1;
const MAX_CREDITS = 8;

export function cleanPolicy(v: unknown): RewardPolicy {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const perAd = Math.round(Number(o.perAd));
  const share = Number(o.share);
  return {
    mode: o.mode === "auto" ? "auto" : "fixed",
    perAd: Number.isFinite(perAd) ? Math.min(MAX_CREDITS, Math.max(MIN_CREDITS, perAd)) : SPOT_REWARD,
    share: Number.isFinite(share) ? Math.min(1, Math.max(0.1, Math.round(share * 100) / 100)) : 0.7,
  };
}

let cache: { at: number; value: RewardNow } | null = null;

/** The reward right now. Cached for 15 minutes; a saved policy clears the cache. */
export async function rewardNow(): Promise<RewardNow> {
  if (cache && Date.now() - cache.at < 15 * 60_000) return cache.value;
  let policy = DEFAULT_POLICY;
  try {
    const [row] = await db().select({ value: schema.appFlags.value }).from(schema.appFlags).where(eq(schema.appFlags.key, "rewardPolicy")).limit(1);
    if (row) policy = cleanPolicy(row.value);
  } catch {}
  let measured: RewardNow["measured"] = null;
  if (policy.mode === "auto") measured = await measure().catch(() => null);
  const perAd =
    policy.mode === "auto" && measured && measured.ads >= MIN_ADS
      ? Math.min(MAX_CREDITS, Math.max(MIN_CREDITS, Math.floor((measured.usdPerAd * policy.share) / ESTIMATE.usdPerCredit)))
      : policy.perAd;
  const value = { perAd, floor: policy.mode === "fixed" && policy.perAd === SPOT_REWARD ? FLOOR_CREDITS : perAd * 2, measured, policy };
  cache = { at: Date.now(), value };
  return value;
}

export const clearRewardCache = () => {
  cache = null;
};

/** Real ad income per finished rewarded ad over the last 14 days. */
async function measure(): Promise<{ usdPerAd: number; ads: number }> {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date();
  const start = new Date(end.getTime() - 13 * 86_400_000);
  const q = rawSql();
  const [rows, network, entries] = await Promise.all([
    q`select
        (select count(*)::int from ad_events where kind = 'reward_completed' and created_at >= now() - interval '14 days') as ads,
        (select coalesce(sum(c.cpm_cents), 0)::bigint from ad_events a join campaigns c on a.creative = 'campaign:' || c.id
          where a.kind = 'impression' and a.created_at >= now() - interval '14 days') as cpm_cents` as unknown as Promise<{ ads: number; cpm_cents: number }[]>,
    adsterraDaily(day(start), day(end)),
    readEntries(),
  ]);
  const since = day(start);
  const usd = Number(rows[0]?.cpm_cents ?? 0) / 100 / 1000 + (network?.days ?? []).reduce((a, d) => a + d.usd, 0) + entries.filter((e) => e.day >= since).reduce((a, e) => a + e.usd, 0);
  const ads = Number(rows[0]?.ads ?? 0);
  return { usdPerAd: ads ? usd / ads : 0, ads };
}
