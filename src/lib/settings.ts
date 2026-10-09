import { MODELS, type ToolId } from "./catalog";

/* Profile-page preferences, stored as one JSON column on users. Shared by the browser and the server. */

export const AD_TOPICS = ["Learning and courses", "Developer tools", "Laptops and phones", "Jobs and internships", "Money and banking", "Design tools", "Games", "Travel"] as const;
export const THEMES = ["system", "light", "dark"] as const;
const TOOLS: ToolId[] = ["chat", "code", "design", "images"];
const NOTIFY = ["coworkerNeedsOk", "bonusReady", "weeklySummary", "productNews"] as const;

export type Theme = (typeof THEMES)[number];
export type Settings = {
  building: string;
  defaultModel: string;
  startIn: ToolId;
  theme: Theme;
  smartPick: boolean;
  askBeforeLong: boolean;
  adTopics: string[];
  personalisedAds: boolean;
  videoSound: boolean;
  notify: Record<(typeof NOTIFY)[number], boolean>;
};

export const DEFAULT_SETTINGS: Settings = {
  building: "",
  defaultModel: "gemini-flash",
  startIn: "chat",
  theme: "system",
  smartPick: true,
  askBeforeLong: true,
  adTopics: ["Learning and courses", "Developer tools", "Jobs and internships"],
  personalisedAds: true,
  videoSound: false,
  notify: { coworkerNeedsOk: true, bonusReady: true, weeklySummary: true, productNews: false },
};

const LIVE_MODELS = new Set(MODELS.filter((m) => m.id !== "gpt" && m.id !== "grok").map((m) => m.id));

/** Merges untrusted input over a base, keeping only known keys with valid values. */
export function cleanSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const bool = (k: string, d: boolean) => (typeof v[k] === "boolean" ? (v[k] as boolean) : d);
  const n = (v.notify && typeof v.notify === "object" ? v.notify : {}) as Record<string, unknown>;
  return {
    building: typeof v.building === "string" ? v.building.trim().slice(0, 500) : base.building,
    defaultModel: typeof v.defaultModel === "string" && LIVE_MODELS.has(v.defaultModel) ? v.defaultModel : base.defaultModel,
    startIn: TOOLS.includes(v.startIn as ToolId) ? (v.startIn as ToolId) : base.startIn,
    theme: THEMES.includes(v.theme as Theme) ? (v.theme as Theme) : base.theme,
    smartPick: bool("smartPick", base.smartPick),
    askBeforeLong: bool("askBeforeLong", base.askBeforeLong),
    adTopics: Array.isArray(v.adTopics) ? AD_TOPICS.filter((t) => (v.adTopics as unknown[]).includes(t)) : base.adTopics,
    personalisedAds: bool("personalisedAds", base.personalisedAds),
    videoSound: bool("videoSound", base.videoSound),
    notify: Object.fromEntries(NOTIFY.map((k) => [k, typeof n[k] === "boolean" ? n[k] : base.notify[k]])) as Settings["notify"],
  };
}

/** Applies a theme to the page and remembers it on this device, so the next load starts right. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    localStorage.setItem("wanlly-theme", theme);
  } catch {}
}
