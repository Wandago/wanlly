import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { errorDetail, errorKind, replyCostUsd, streamReply } from "@/lib/ai";
import { ESTIMATE, MODELS, TOOLS, jobCost, taskCredits } from "@/lib/catalog";
import { MAX_BODY, readAttachments } from "@/lib/attachments";
import { getStyle } from "@/lib/design-styles";
import { CONTINUE, MAX_PAGE, designFile, extractHtml, idParam, isComplete, packAssets, systemPrompt, systemStyles, unpackAssets, userPrompt } from "@/lib/design";
import { field, jsonUpTo } from "@/lib/forms";
import { account, chargeExtra, release, spend } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/*
 * Makes one new version of a design, streamed as newline-delimited JSON like chat:
 *   {"type":"start"} {"type":"text","text":"…"} … {"type":"done","versionId":…} or {"type":"error",…}
 * The text is the HTML as it's written, so the editor can preview it live. Same pricing as chat:
 * the upfront price is refunded if no usable page arrives; long Claude replies pay their real cost.
 */

const ERRORS = {
  busy: "The model is busy right now. Your credits were refunded; try again in a moment.",
  failed: "Something went wrong making that design. Your credits were refunded.",
  unavailable: "That model isn't available right now. Your credits were refunded; try another model.",
  aborted: "Stopped. Your credits were refunded.",
  nohtml: "The model didn't return a complete page. Your credits were refunded; try again or rephrase.",
} as const;

export async function POST(req: Request, ctx: RouteContext<"/api/design/[id]/generate">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const blocked = await blockedReason(userId, "spend").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const id = idParam((await ctx.params).id);
  const data = await jsonUpTo(req, MAX_BODY);
  if (!data) return Response.json({ error: "That's too much to send at once. Attach smaller or fewer files." }, { status: 413 });
  const attached = readAttachments(data.attachments);
  if (!attached) return Response.json({ error: "Those files can't be sent. Use images, PDFs or text files, up to 4 at a time." }, { status: 400 });
  const typed = typeof data.prompt === "string" ? data.prompt.trim().slice(0, 4000) : "";
  const request = typed || (attached.meta.length ? "Use what I've attached." : "");
  const model = MODELS.find((m) => m.id === data?.modelId);
  const jobId = data ? field(data, "jobId", 64) : "";
  const baseVersion = data && Number.isSafeInteger(data.baseVersionId) ? (data.baseVersionId as number) : null;
  const systemId = data && Number.isSafeInteger(data.systemId) ? (data.systemId as number) : null;
  const style = getStyle(data?.styleId);
  if (!id || !request || !model || !/^[\w-]{8,64}$/.test(jobId)) return Response.json({ error: "Bad request" }, { status: 400 });

  const d = db();
  const v = schema.designVersions;
  let file: Awaited<ReturnType<typeof designFile>>;
  let current: string | null = null;
  let system: { name: string; css: string } | undefined;
  try {
    file = await designFile(userId, id);
    if (!file) return Response.json({ error: "Not found" }, { status: 404 });
    // Edit the version the person is looking at, or the newest one.
    const [row] = await d
      .select({ html: v.html })
      .from(v)
      .where(baseVersion ? sql`${v.projectId} = ${id} and ${v.id} = ${baseVersion}` : eq(v.projectId, id))
      .orderBy(desc(v.id))
      .limit(1);
    current = row?.html ?? null;
    // The design system to build on: one of this person's own Design System files.
    if (systemId && systemId !== id) {
      const sys = await designFile(userId, systemId);
      if (sys?.kind === "system") {
        const [latest] = await d.select({ html: v.html }).from(v).where(eq(v.projectId, systemId)).orderBy(desc(v.id)).limit(1);
        if (latest) system = { name: sys.name, css: systemStyles(latest.html) };
      }
    }
  } catch (e) {
    console.error("design setup failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  const price = jobCost(TOOLS.design, model);
  const ref = `job:${userId}:${jobId}`;
  const paid = await spend(userId, price, ref, `Design · ${model.name}`).catch(() => null);
  if (!paid || !paid.ok) {
    const acct = await account(userId).catch(() => null);
    const reason = paid?.reason ?? "failed";
    const status = reason === "credits" ? 402 : reason === "day" || reason === "week" ? 429 : reason === "duplicate" ? 409 : 503;
    return Response.json({ error: reason === "credits" ? "Not enough credits" : "Couldn't start that", reason, price, ...(acct ?? {}) }, { status });
  }

  const abort = new AbortController();
  const enc = new TextEncoder();
  // Images already in the page and newly attached ones travel as short names (see packAssets).
  const { packed, assets } = packAssets(current ?? "");
  const images = attached.files.filter((f) => f.mime.startsWith("image/")).map((f, n) => ({ key: `asset:img-${n + 1}`, name: f.name, url: `data:${f.mime};base64,${f.data}` }));
  for (const i of images) assets.set(i.key, i.url);
  const turns = [
    {
      role: "user" as const,
      text: userPrompt({ name: file.name, brief: [file.about, file.instructions].filter(Boolean).join("\n"), request, current: current ? packed : null, images, files: attached.text, system, style }),
      files: attached.files.map((f) => ({ mime: f.mime, data: f.data })),
    },
  ];

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: object) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {}
      };
      send({ type: "start", price });
      let reply = "";
      try {
        let usage = { inputTokens: 0, outputTokens: 0, stop: "end" };
        // A long page can run out of room; ask the model to carry on, up to twice.
        for (let round = 0; round < 3; round++) {
          const ask = round === 0 ? turns : [...turns, { role: "assistant" as const, text: reply }, { role: "user" as const, text: CONTINUE }];
          for await (const ev of streamReply({ modelId: model.id, tool: "design", system: systemPrompt(file.kind), turns: ask, signal: abort.signal })) {
            if (ev.type === "text") {
              reply += ev.text;
              send({ type: "text", text: ev.text });
            } else usage = { inputTokens: usage.inputTokens + ev.inputTokens, outputTokens: usage.outputTokens + ev.outputTokens, stop: ev.stop };
          }
          if (isComplete(reply) || usage.stop === "refusal" || !reply) break;
          // Continuations must not reopen the code fence.
          reply = reply.replace(/\n```\s*$/, "");
        }
        const found = extractHtml(reply);
        const html = found ? unpackAssets(found, assets) : null;
        if (!html || html.length > MAX_PAGE) {
          await release(userId, price, ref);
          send({ type: "error", message: html ? "That page came out too large to save. Your credits were refunded; try fewer or smaller images." : ERRORS.nohtml, ...(await account(userId)) });
        } else {
          // Bigger tasks cost more: the work the model did, never less than the starting price.
        const actual = taskCredits(price, model, usage.inputTokens, usage.outputTokens, Math.ceil(replyCostUsd(model.id, usage.inputTokens, usage.outputTokens) / ESTIMATE.usdPerCredit));
          const extra = actual > price ? await chargeExtra(userId, actual - price, `${ref}:extra`, `${model.name} · bigger task`) : 0;
          const [row] = await d.insert(v).values({ projectId: id, prompt: request, html, modelId: model.id, credits: price + extra }).returning({ id: v.id, createdAt: v.createdAt });
          await d.update(schema.projects).set({ updatedAt: sql`now()` }).where(eq(schema.projects.id, id));
          send({ type: "done", versionId: row.id, createdAt: row.createdAt, charged: price + extra, cutShort: !isComplete(reply), ...(await account(userId)) });
        }
      } catch (e) {
        const kind = errorKind(e);
        if (kind !== "aborted") console.error("design failed", kind, errorDetail(e));
        let detail = "";
        if (kind !== "aborted") {
          const [me] = await d.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1).catch(() => []);
          if (me && me.role !== "user") detail = ` (Admin detail: ${errorDetail(e)})`;
        }
        await release(userId, price, ref).catch(() => {});
        send({ type: "error", message: ERRORS[kind] + detail, ...(await account(userId).catch(() => ({}))) });
      }
      try {
        controller.close();
      } catch {}
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
