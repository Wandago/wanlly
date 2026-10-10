import { rawSql } from "@/db";
import { adsterraDaily } from "@/lib/adsterra";
import { replyCostUsd } from "@/lib/ai";
import { CAN, rangeDays, requireStaff } from "@/lib/admin";
import { ESTIMATE, IN_PER_UNIT, MODELS, OUT_PER_UNIT } from "@/lib/catalog";
import { jsonUpTo } from "@/lib/forms";
import { cleanEntry, readEntries, writeEntries } from "@/lib/revenue-log";

/*
 * Real money, no estimates: what came in (sold campaigns at their agreed price, Adsterra's own
 * report, income recorded by hand) and what the models really cost, from the tokens each reply
 * and design used. Also the token side of credits: how many tokens one credit buys per model.
 */

const rows = (r: unknown) => r as Record<string, unknown>[];
const n = (v: unknown) => Number(v ?? 0);

export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  const days = rangeDays(req);
  const since = `${days - 1} days`;
  try {
    const q = rawSql();
    const [dayList, campaigns, usage, offers] = await Promise.all([
      q`select to_char(d, 'YYYY-MM-DD') as day from generate_series(date_trunc('day', now()) - ${since}::interval, date_trunc('day', now()), interval '1 day') d order by d`,
      // Sold campaigns: impressions × agreed price per 1,000.
      q`select to_char(date_trunc('day', a.created_at), 'YYYY-MM-DD') as day, coalesce(sum(c.cpm_cents), 0)::bigint as cpm_cents
        from ad_events a join campaigns c on a.creative = 'campaign:' || c.id
        where a.kind = 'impression' and a.created_at >= date_trunc('day', now()) - ${since}::interval group by 1`,
      // Tokens per day and model: chat and code replies, plus design versions once migration 0014 has run.
      q`select day, model_id, sum(replies)::int as replies, sum(input)::bigint as input, sum(output)::bigint as output, sum(credits)::bigint as credits from (
          select to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD') as day, m.model_id, count(*) as replies,
            coalesce(sum(m.input_tokens), 0) as input, coalesce(sum(m.output_tokens), 0) as output, coalesce(sum(m.credits), 0) as credits
          from messages m where m.role = 'assistant' and m.model_id is not null and m.created_at >= date_trunc('day', now()) - ${since}::interval group by 1, 2
          union all
          select to_char(date_trunc('day', v.created_at), 'YYYY-MM-DD'), v.model_id, count(*),
            coalesce(sum((to_jsonb(v)->>'input_tokens')::int), 0), coalesce(sum((to_jsonb(v)->>'output_tokens')::int), 0), coalesce(sum(v.credits), 0)
          from design_versions v where v.created_at >= date_trunc('day', now()) - ${since}::interval group by 1, 2
        ) t group by day, model_id`,
      // Sponsor offers the partner confirmed, at the payout they reported.
      q`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, coalesce(sum(revenue_micros), 0)::bigint as micros
        from ad_events where kind = 'reward_completed' and partner like 'offer:%' and created_at >= date_trunc('day', now()) - ${since}::interval group by 1`,
    ]);
    const list = rows(dayList).map((r) => String(r.day));
    const start = list[0];
    const end = list[list.length - 1];
    const [network, entries] = await Promise.all([adsterraDaily(start, end), readEntries()]);

    const byDay = new Map(list.map((d) => [d, { day: d, campaigns: 0, network: 0, manual: 0, offers: 0, cost: 0, credits: 0 }]));
    for (const r of rows(offers)) {
      const d = byDay.get(String(r.day));
      if (d) d.offers += n(r.micros) / 1e6;
    }
    for (const r of rows(campaigns)) {
      const d = byDay.get(String(r.day));
      if (d) d.campaigns += n(r.cpm_cents) / 100 / 1000;
    }
    for (const x of network?.days ?? []) {
      const d = byDay.get(x.day);
      if (d) d.network += x.usd;
    }
    for (const e of entries) {
      const d = byDay.get(e.day);
      if (d) d.manual += e.usd;
    }
    const models = new Map<string, { model: string; name: string; replies: number; input: number; output: number; credits: number; cost: number }>();
    for (const r of rows(usage)) {
      const id = String(r.model_id);
      const input = n(r.input);
      const output = n(r.output);
      const cost = replyCostUsd(id, input, output);
      const d = byDay.get(String(r.day));
      if (d) {
        d.cost += cost;
        d.credits += n(r.credits);
      }
      const m = models.get(id) ?? { model: id, name: MODELS.find((x) => x.id === id)?.name ?? id, replies: 0, input: 0, output: 0, credits: 0, cost: 0 };
      m.replies += n(r.replies);
      m.input += input;
      m.output += output;
      m.credits += n(r.credits);
      m.cost += cost;
      models.set(id, m);
    }
    // What one credit buys on each model, and what those tokens cost us.
    const rates = MODELS.filter((m) => m.provider).map((m) => {
      const outPerCredit = Math.round(OUT_PER_UNIT / m.credits);
      const inPerCredit = Math.round(IN_PER_UNIT / m.credits);
      return { model: m.id, name: m.name, credits: m.credits, outPerCredit, inPerCredit, costOut: replyCostUsd(m.id, 0, outPerCredit), costIn: replyCostUsd(m.id, inPerCredit, 0) };
    });
    return Response.json({
      days,
      usdPerCredit: ESTIMATE.usdPerCredit,
      daily: [...byDay.values()],
      models: [...models.values()].sort((a, b) => b.input + b.output - (a.input + a.output)),
      rates,
      network: network ? { connected: !network.error, error: network.error ?? null } : { connected: false, error: null },
      entries: entries.filter((e) => e.day >= start).sort((a, b) => b.day.localeCompare(a.day)),
    });
  } catch (e) {
    console.error("admin money failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/** Record income by hand: { day, source, usd, note }. */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const entry = cleanEntry(await jsonUpTo(req, 2000));
  if (!entry) return Response.json({ error: "Give a date, a source and an amount above zero." }, { status: 400 });
  const all = await readEntries();
  await writeEntries([...all, entry], staff.id);
  return Response.json({ entry });
}

/** Remove a recorded entry: ?id= */
export async function DELETE(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const id = new URL(req.url).searchParams.get("id");
  const all = await readEntries();
  await writeEntries(all.filter((e) => e.id !== id), staff.id);
  return Response.json({ ok: true });
}
