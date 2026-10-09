import { TOOLS, MODELS, jobCost, type ToolId } from "@/lib/catalog";
import { smallJson, field } from "@/lib/forms";
import { balance, spend } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/** Models people can spend on today. GPT and Grok are listed as coming soon. */
const LIVE = new Set(["haiku", "sonnet", "opus", "fable", "gemini-flash"]);

/** Charges for one job. The price comes from the catalog here, never from the browser. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const toolId = field(data, "tool", 20) as ToolId;
  const modelId = field(data, "modelId", 40);
  const jobId = field(data, "jobId", 64);
  const tool = Object.hasOwn(TOOLS, toolId) ? TOOLS[toolId] : undefined;
  const model = MODELS.find((m) => m.id === modelId);
  if (!tool || !model || !LIVE.has(model.id) || !/^[\w-]{8,64}$/.test(jobId)) return Response.json({ error: "Bad request" }, { status: 400 });

  const price = jobCost(tool, model);
  try {
    const credits = await spend(userId, price, `job:${userId}:${jobId}`, `${tool.label} · ${model.name}`);
    if (credits === null) return Response.json({ error: "Not enough credits", credits: await balance(userId), price }, { status: 402 });
    return Response.json({ ok: true, credits, price });
  } catch (e) {
    console.error("spend failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
