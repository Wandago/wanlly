import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { errorDetail, errorKind, replyCostUsd, streamReply, type Turn } from "@/lib/ai";
import { ESTIMATE, MODELS, TOOLS, jobCost, type ToolId } from "@/lib/catalog";
import { field, smallJson } from "@/lib/forms";
import { account, chargeExtra, release, spend } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/*
 * One reply, streamed as newline-delimited JSON:
 *   {"type":"start","conversationId":12}  {"type":"text","text":"…"} …  {"type":"done",…} or {"type":"error",…}
 * The upfront price is taken before the model is called; a reply that fails before any text
 * arrives is refunded, and a long Claude reply is charged its real cost, never below zero.
 */

const TEXT_TOOLS: ToolId[] = ["chat", "code"];
/** How much earlier conversation is sent with each message, newest first. */
const HISTORY_CHARS = 48_000;

const SYSTEM: Record<"chat" | "code", string> = {
  chat:
    "You are the assistant in Wanlly, a free AI workspace for students and independent creators around the world. " +
    "Be clear, warm and practical. Answer directly, then add detail only when it helps. Use Markdown: short paragraphs, " +
    "lists when they help, and fenced code blocks with a language tag. Many people read on a phone, so keep lines short.",
  code:
    "You are the coding assistant in Wanlly, a free AI workspace for students and independent creators. Write complete, " +
    "working code in fenced code blocks with a language tag, and put the file path on the line before each block when " +
    "there is more than one file. Prefer simple, well-known tools that run on cheap hardware. Explain briefly what you " +
    "changed and how to run it. If something is ambiguous, make a sensible choice and say what you assumed.",
};

const ERRORS = {
  busy: "The model is busy right now. Your credits were refunded; try again in a moment.",
  failed: "Something went wrong getting that reply. Your credits were refunded.",
  unavailable: "That model isn't switched on yet. Try Gemini Flash.",
  aborted: "Stopped.",
} as const;

export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const blocked = await blockedReason(userId, "spend").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });

  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const text = typeof data.message === "string" ? data.message.trim().slice(0, 6000) : "";
  const toolId = data.tool as ToolId;
  const model = MODELS.find((m) => m.id === data.modelId);
  const jobId = field(data, "jobId", 64);
  const conversationId = Number.isSafeInteger(data.conversationId) ? (data.conversationId as number) : null;
  const projectId = Number.isSafeInteger(data.projectId) ? (data.projectId as number) : null;
  if (!text || !TEXT_TOOLS.includes(toolId) || !model || !/^[\w-]{8,64}$/.test(jobId)) return Response.json({ error: "Bad request" }, { status: 400 });

  const d = db();
  let convo: { id: number; projectId: number | null };
  let instructions = "";
  try {
    if (conversationId) {
      const [c] = await d
        .select({ id: schema.conversations.id, projectId: schema.conversations.projectId })
        .from(schema.conversations)
        .where(and(eq(schema.conversations.id, conversationId), eq(schema.conversations.userId, userId)))
        .limit(1);
      if (!c) return Response.json({ error: "Conversation not found" }, { status: 404 });
      convo = c;
    } else {
      let pid: number | null = null;
      if (projectId) {
        const [p] = await d
          .select({ id: schema.projects.id })
          .from(schema.projects)
          .where(and(eq(schema.projects.id, projectId), eq(schema.projects.ownerId, userId), isNull(schema.projects.deletedAt)))
          .limit(1);
        pid = p?.id ?? null;
      }
      const title = text.replace(/\s+/g, " ").slice(0, 60);
      const [c] = await d.insert(schema.conversations).values({ userId, tool: toolId, title, projectId: pid }).returning({ id: schema.conversations.id, projectId: schema.conversations.projectId });
      convo = c;
    }
    if (convo.projectId) {
      const [p] = await d.select({ instructions: schema.projects.instructions }).from(schema.projects).where(eq(schema.projects.id, convo.projectId)).limit(1);
      instructions = p?.instructions ?? "";
    }
  } catch (e) {
    console.error("chat setup failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Take the upfront price. Limits and balance are checked in the same locked statement.
  const price = jobCost(TOOLS[toolId], model);
  const ref = `job:${userId}:${jobId}`;
  const paid = await spend(userId, price, ref, `${TOOLS[toolId].label} · ${model.name}`).catch(() => null);
  if (!paid || !paid.ok) {
    const acct = await account(userId).catch(() => null);
    const reason = paid?.reason ?? "failed";
    const status = reason === "credits" ? 402 : reason === "day" || reason === "week" ? 429 : reason === "duplicate" ? 409 : 503;
    return Response.json({ error: reason === "credits" ? "Not enough credits" : "Couldn't start that reply", reason, ...(acct ?? {}) }, { status });
  }

  // Earlier turns of this conversation, newest kept first within the budget.
  let turns: Turn[] = [];
  try {
    const rows = await d
      .select({ role: schema.messages.role, content: schema.messages.content })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, convo.id))
      .orderBy(desc(schema.messages.id))
      .limit(40);
    let used = text.length;
    for (const r of rows) {
      const t = String((r.content as { text?: string })?.text ?? "");
      if (!t || used + t.length > HISTORY_CHARS) break;
      used += t.length;
      turns.unshift({ role: r.role, text: t });
    }
    await d.insert(schema.messages).values({ conversationId: convo.id, role: "user", content: { text } });
  } catch (e) {
    console.error("chat history failed", e);
    await release(userId, price, ref).catch(() => {});
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
  turns.push({ role: "user", text });
  // Providers want turns to alternate and start with the person, so merge any repeats.
  turns = turns.reduce<Turn[]>((acc, t) => {
    const last = acc[acc.length - 1];
    if (last && last.role === t.role) last.text += `\n\n${t.text}`;
    else acc.push({ ...t });
    return acc;
  }, []);
  while (turns[0]?.role === "assistant") turns.shift();

  const system = SYSTEM[toolId as "chat" | "code"] + (instructions ? `\n\nThe person set these instructions for this project. Follow them:\n<project_instructions>\n${instructions}\n</project_instructions>` : "");
  const abort = new AbortController();
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ type: "start", conversationId: convo.id });
      let reply = "";
      try {
        let usage = { inputTokens: 0, outputTokens: 0, stop: "end" };
        for await (const ev of streamReply({ modelId: model.id, tool: toolId, system, turns, signal: abort.signal })) {
          if (ev.type === "text") {
            reply += ev.text;
            send({ type: "text", text: ev.text });
          } else usage = ev;
        }
        // Real cost in credits; anything above the upfront price is charged now.
        const actual = Math.ceil(replyCostUsd(model.id, usage.inputTokens, usage.outputTokens) / ESTIMATE.usdPerCredit);
        const extra = actual > price ? await chargeExtra(userId, actual - price, `${ref}:extra`, `${model.name} · long reply`) : 0;
        if (!reply && usage.stop !== "end") {
          await release(userId, price, ref);
          send({ type: "error", message: usage.stop === "refusal" ? "The model declined to answer that. Your credits were refunded." : ERRORS.failed, refunded: true, ...(await account(userId)) });
        } else {
          await d.insert(schema.messages).values({
            conversationId: convo.id,
            role: "assistant",
            content: { text: reply, stop: usage.stop },
            modelId: model.id,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            credits: price + extra,
          });
          send({ type: "done", charged: price + extra, stop: usage.stop, ...(await account(userId)) });
        }
      } catch (e) {
        const kind = errorKind(e);
        if (kind !== "aborted") console.error("chat reply failed", kind, errorDetail(e));
        // The team sees the provider's own words, so problems can be fixed without digging in logs.
        let detail = "";
        if (kind !== "aborted") {
          const [me] = await d.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1).catch(() => []);
          if (me && me.role !== "user") detail = ` (Admin detail: ${errorDetail(e)})`;
        }
        try {
          if (reply) {
            // Part of the answer arrived: keep it and the price.
            await d.insert(schema.messages).values({ conversationId: convo.id, role: "assistant", content: { text: reply, stop: "interrupted" }, modelId: model.id, credits: price });
            send({ type: "done", charged: price, stop: "interrupted", ...(await account(userId)) });
          } else {
            await release(userId, price, ref);
            send({ type: "error", message: ERRORS[kind] + detail, refunded: true, ...(await account(userId)) });
          }
        } catch (e2) {
          console.error("chat cleanup failed", e2);
        }
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
