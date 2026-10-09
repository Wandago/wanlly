import type { VideoAspect } from "./ads";

export type ToolId = "chat" | "code" | "design" | "images";

export type Model = {
  id: string;
  name: string;
  group: "Anthropic" | "Google" | "Other providers";
  description: string;
  /** Credits a reply costs at least. One credit is half a US cent of model cost; long replies cost more. */
  credits: number;
  /** Who runs it. Models whose provider has no key yet show as "soon". */
  provider: "anthropic" | "google" | null;
};

/** Which illustration the cover art draws. Real sponsors upload their own cover image. */
export type CoverKind = "db" | "deploy" | "type" | "print" | "notes" | "laptop" | "course" | "jobs";

export type Sponsor = {
  name: string;
  cover?: CoverKind;
  initial: string;
  color: string;
  /** Short line for display banners and video. */
  headline: string;
  text: string;
  cta: string;
  /** Set for directly sold ads: where the card links, its campaign, and an uploaded picture. */
  url?: string;
  campaignId?: number;
  /** Most views per person per day, for sold campaigns. */
  cap?: number;
  image?: string;
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
  { id: "haiku", name: "Haiku 5.5", group: "Anthropic", description: "Fast everyday answers", credits: 1, provider: "anthropic" },
  { id: "sonnet", name: "Sonnet 5.5", group: "Anthropic", description: "Best balance for chat and code", credits: 2, provider: "anthropic" },
  { id: "opus", name: "Opus 5.5", group: "Anthropic", description: "Deep reasoning, long tasks", credits: 4, provider: "anthropic" },
  { id: "fable", name: "Fable 5.1", group: "Anthropic", description: "Most capable, for the hardest work", credits: 10, provider: "anthropic" },
  { id: "gemini-flash", name: "Gemini Flash", group: "Google", description: "Fast, good for everyday work. Start here", credits: 1, provider: "google" },
  { id: "gpt", name: "GPT", group: "Other providers", description: "OpenAI, chat and Codex", credits: 2, provider: null },
  { id: "grok", name: "Grok", group: "Other providers", description: "xAI, fast with live web", credits: 2, provider: null },
];

/** The model new accounts start on, and the one suggested when credits are short. Live on Google's free tier. */
export const CHEAPEST_MODEL_ID = "gemini-flash";

export type Providers = { anthropic: boolean; google: boolean };
/** Whether a model can run, given which providers have keys. */
export const isLive = (m: Model, p: Providers | null) => !!m.provider && (p ? p[m.provider] : m.provider === "google");
export const IMAGE_MODEL_NAME = "Gemini Image";
/** Bonus credits for the first video each day (about $0.04). Every later video earns SPOT_REWARD. */
export const FLOOR_CREDITS = 8;
export const SPOT_REWARD = 4;
export const SPONSOR_TRIAL_REWARD = 25;

/*
 * Usage limits, the same size for everyone but on each person's own clock. They cap what anyone
 * can spend however many credits they have saved, so no single account can run up the model bill.
 * A session starts with your first spend and lasts 6 hours; a week starts the same way and lasts 7 days.
 */
export const DAILY_SPEND_LIMIT = 100;
export const WEEKLY_SPEND_LIMIT = 500;
export const SESSION_HOURS = 6;
/** Most paid videos per day. */
export const DAILY_VIDEO_CAP = 30;

/*
 * Planning numbers for the admin page's revenue estimate, until an ad network reports real money.
 * eCPM is US dollars per 1,000 viewable impressions; a credit costs about half a US cent of model use.
 */
export const ESTIMATE = {
  ecpm: { native: 1.2, display: 0.6, rewarded: 8 },
  usdPerCredit: 0.005,
} as const;

export type Usage = {
  dayUsed: number;
  dayLimit: number;
  weekUsed: number;
  weekLimit: number;
  videos: number;
  videoCap: number;
  /** ISO times when this person's session and week reset; null when none is running. */
  dayResetsAt: string | null;
  weekResetsAt: string | null;
};
/** Demo spots are short; real ones run 15 to 20 seconds. */
export const SPOT_SECONDS = 5;

/** House sponsor for spots started outside a job (the earn sheet and the out-of-credits gate). */
export const SPOT_SPONSOR: Sponsor = {
  name: "Fieldnote",
  initial: "F",
  color: "#1e7a55",
  cover: "notes",
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
      cover: "db",
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
      cover: "deploy",
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
      cover: "type",
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
    // A picture from Gemini's image model; covers its paid price (about $0.04) when that applies.
    flatCredits: 5,
    durationMs: 12000,
    steps: ["Reading your idea", "Drawing", "Finishing"],
    suggestions: ["Mug on a sunlit counter, film grain", "Flat-lay of a desk setup"],
    sponsor: {
      name: "Printwell",
      cover: "print",
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

/** Student-friendly sponsors that rotate through the side panels. */
export const RAIL_SPONSORS: Sponsor[] = [
  {
    name: "Lumen Laptops",
    cover: "laptop",
    initial: "L",
    color: "#4f46e5",
    headline: "Student pricing on every laptop.",
    text: "Verify your student email and save up to 20% on the machine you'll build on.",
    cta: "See student prices",
  },
  {
    name: "Courseway",
    cover: "course",
    initial: "C",
    color: "#c2410c",
    headline: "Ship your first app in 30 days.",
    text: "A free, project-based course. Build along with Wanlly and get a certificate.",
    cta: "Start free",
  },
  {
    name: "Internly",
    cover: "jobs",
    initial: "I",
    color: "#0f766e",
    headline: "Paid internships, remote-first.",
    text: "Companies hiring students who build. Your Wanlly projects count as a portfolio.",
    cta: "Browse roles",
  },
  SPOT_SPONSOR,
];

export function getModel(id: string): Model {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function jobCost(tool: Tool, model: Model): number {
  return tool.flatCredits ?? model.credits * (tool.multiplier ?? 1);
}

/** Output tokens (about 1,500 words) that cost one "model credit" of work. */
export const OUT_PER_UNIT = 2000;
/** Input tokens (the conversation, files and pictures read) per model credit. */
export const IN_PER_UNIT = 20000;
/** No single job costs more than this many times the model's credits. */
const JOB_CAP = 40;

/**
 * What a finished job costs: the tool's starting price, or the work it took if that's more.
 * Work is how much the model read and wrote, at the model's rate, so a one-line answer and a
 * 30-slide deck cost what they're worth on every model. `realCredits` is the provider's actual
 * bill in credits, so a model never runs at a loss.
 */
export function taskCredits(start: number, model: Model, inputTokens: number, outputTokens: number, realCredits = 0): number {
  const work = Math.ceil(model.credits * (outputTokens / OUT_PER_UNIT + inputTokens / IN_PER_UNIT));
  return Math.max(start, Math.min(Math.max(work, realCredits), Math.max(start, model.credits * JOB_CAP)));
}
