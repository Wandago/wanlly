import "server-only";

/*
 * Real earnings from Adsterra's publisher API (api3.adsterratools.com/publisher/stats.json),
 * with the API token from Adsterra → Settings → API kept in the ADSTERRA_API_KEY secret.
 * Results are cached for 15 minutes so the admin page doesn't call Adsterra on every view.
 */

export type NetworkDay = { day: string; impressions: number; clicks: number; usd: number };

let cache: { key: string; at: number; days: NetworkDay[] } | null = null;

export async function adsterraDaily(start: string, end: string): Promise<{ days: NetworkDay[]; error?: string } | null> {
  const key = process.env.ADSTERRA_API_KEY;
  if (!key) return null;
  const ck = `${start}:${end}`;
  if (cache?.key === ck && Date.now() - cache.at < 15 * 60_000) return { days: cache.days };
  try {
    const url = `https://api3.adsterratools.com/publisher/stats.json?start_date=${start}&finish_date=${end}&group_by%5B%5D=date`;
    const r = await fetch(url, { headers: { "X-API-Key": key, accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return { days: [], error: `Adsterra answered ${r.status}${r.status === 401 || r.status === 403 ? " (check the API token)" : ""}` };
    const body = (await r.json()) as { items?: Record<string, unknown>[] };
    const days = (body.items ?? []).map((it) => ({
      day: String(it.date ?? it.day ?? "").slice(0, 10),
      impressions: Number(it.impression ?? it.impressions ?? 0),
      clicks: Number(it.clicks ?? it.click ?? 0),
      usd: Number(it.revenue ?? it.income ?? 0),
    }));
    cache = { key: ck, at: Date.now(), days };
    return { days };
  } catch (e) {
    return { days: [], error: `Couldn't reach Adsterra: ${e instanceof Error ? e.message : String(e)}` };
  }
}
