import "server-only";
import { field } from "./forms";
import { MODELS, type ToolId } from "./catalog";

export const MAX_PROJECTS = 50;
const TOOLS: ToolId[] = ["chat", "code", "design", "images"];
const LIVE_MODELS = new Set(MODELS.filter((m) => m.id !== "gpt" && m.id !== "grok").map((m) => m.id));

/** The editable fields present in a request body, validated. Missing fields are left out. */
export function projectFields(data: Record<string, unknown>) {
  const out: { name?: string; about?: string; instructions?: string; tool?: ToolId; modelId?: string } = {};
  if ("name" in data) out.name = field(data, "name", 80);
  if ("about" in data) out.about = field(data, "about", 300);
  if ("instructions" in data) out.instructions = field(data, "instructions", 4000);
  if (TOOLS.includes(data.tool as ToolId)) out.tool = data.tool as ToolId;
  if (typeof data.modelId === "string" && LIVE_MODELS.has(data.modelId)) out.modelId = data.modelId;
  return out;
}

