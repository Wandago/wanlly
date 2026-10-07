import type { VideoAspect } from "./ads";

export type ToolId = "chat" | "code" | "design" | "images";

export type Model = {
  id: string;
  name: string;
  group: "Anthropic" | "Other providers";
  description: string;
  /** Credits per chat message. One credit is half a US cent of model cost. */
  credits: number;
};

export type Sponsor = {
  name: string;
  initial: string;
  color: string;
  /** Short line for display banners and video. */
  headline: string;
  text: string;
  cta: string;
};

export type Tool = {
  id: ToolId;
  label: string;
  placeholder: string;
  /** Job cost = model credits × multiplier, unless the tool has a flat price. */
  multiplier?: number;
  flatCredits?: number;
  durationMs: number;
  steps: string[];
  suggestions: string[];
  sponsor: Sponsor;
  /** Shape of the rewarded spot this tool's demo plays. Real spots arrive in any of the three. */
  spotAspect: VideoAspect;
  /** Which kind of ad this tool's demo shows while working. */
  adFormat: "native" | "display";
  sample: string;
};

export const MODELS: Model[] = [
  { id: "haiku", name: "Haiku 5.5", group: "Anthropic", description: "Fast everyday answers", credits: 0 },
  { id: "sonnet", name: "Sonnet 5.5", group: "Anthropic", description: "Best balance for chat and code", credits: 2 },
  { id: "opus", name: "Opus 5.5", group: "Anthropic", description: "Deep reasoning, long tasks", credits: 4 },
  { id: "fable", name: "Fable 5.1", group: "Anthropic", description: "Most capable, for the hardest work", credits: 10 },
  { id: "gpt", name: "GPT", group: "Other providers", description: "OpenAI, chat and Codex", credits: 2 },
  { id: "grok", name: "Grok", group: "Other providers", description: "xAI, fast with live web", credits: 2 },
];

export const FREE_MODEL_ID = "haiku";
export const IMAGE_MODEL_NAME = "Wanlly Image";
export const DAILY_ALLOWANCE = 40;
export const SPOT_REWARD = 4;
export const SPONSOR_TRIAL_REWARD = 25;
/** Demo spots are short; real ones run 15 to 20 seconds. */
export const SPOT_SECONDS = 5;

/** House sponsor for spots started outside a job (the earn sheet and the out-of-credits gate). */
export const SPOT_SPONSOR: Sponsor = {
  name: "Fieldnote",
  initial: "F",
  color: "#1e7a55",
  headline: "Notes that organize themselves.",
  text: "Free for students.",
  cta: "Try it",
};

export const TOOL_ORDER: ToolId[] = ["chat", "code", "design", "images"];

export const TOOLS: Record<ToolId, Tool> = {
  chat: {
    id: "chat",
    label: "Chat",
    placeholder: "Message Wanlly",
    multiplier: 1,
    durationMs: 3200,
    steps: ["Thinking", "Writing the answer"],
    suggestions: ["Explain prompt caching simply", "Compare Sonnet and Opus for coding"],
    sponsor: {
      name: "Northbeam DB",
      headline: "Postgres that bills by the query.",
      initial: "N",
      color: "#0e7c66",
      text: "Usage-based Postgres with a free tier. Good fit for a credits table.",
      cta: "Learn more",
    },
    spotAspect: "16:9",
    adFormat: "native",
    sample: "How should I price an AI app that's free for most people but still profitable?",
  },
  code: {
    id: "code",
    label: "Code",
    placeholder: "Describe a change to wandago/wanlly",
    multiplier: 3,
    durationMs: 7000,
    steps: ["Reading 14 files", "Planning the change", "Editing files", "Running tests"],
    suggestions: ["Add dark mode to settings", "Write tests for the ledger"],
    sponsor: {
      name: "Railhouse",
      headline: "Ship every branch to its own URL.",
      initial: "R",
      color: "#2747d8",
      text: "Your repo is a Next.js app. Deploy this branch to a preview URL with $5 of hosting credit.",
      cta: "Deploy preview",
    },
    spotAspect: "16:9",
    adFormat: "native",
    sample: "Add a credit ledger that charges each model call in half-cents",
  },
  design: {
    id: "design",
    label: "Design",
    placeholder: "Describe a screen or page",
    multiplier: 2,
    durationMs: 5200,
    steps: ["Reading the brief", "Laying out the screen", "Choosing type and color"],
    suggestions: ["Pricing page with three plans", "Settings screen, mobile"],
    sponsor: {
      name: "Typecase",
      headline: "Type that makes the mock.",
      initial: "T",
      color: "#3a3340",
      text: "The display face in this mock is free for your first project.",
      cta: "Get the font",
    },
    spotAspect: "1:1",
    adFormat: "display",
    sample: "Onboarding screen for a habit app. Warm, confident, one clear action.",
  },
  images: {
    id: "images",
    label: "Images",
    placeholder: "Describe an image",
    flatCredits: 3,
    durationMs: 4800,
    steps: ["Composing", "Rendering 4 images", "Upscaling"],
    suggestions: ["Mug on a sunlit counter, film grain", "Flat-lay of a desk setup"],
    sponsor: {
      name: "Printwell",
      headline: "Your images, printed.",
      initial: "P",
      color: "#b4235a",
      text: "Turn any of these into a poster or a mug. First print ships free.",
      cta: "See prints",
    },
    spotAspect: "9:16",
    adFormat: "display",
    sample: "A ceramic mug on a sunlit kitchen counter, morning light",
  },
};

export function getModel(id: string): Model {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function jobCost(tool: Tool, model: Model): number {
  return tool.flatCredits ?? model.credits * (tool.multiplier ?? 1);
}
