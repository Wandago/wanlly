"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
  IMAGE_MODEL_NAME,
  TOOLS,
  getModel,
  jobCost,
  type ToolId,
  type Usage,
} from "./catalog";
import type { Settings } from "./settings";

/* Credits live on the server (the ledger). Job results are still simulated with timers until chat is connected. */

export type SpotState = "idle" | "playing" | "earned";

export type Job = {
  id: string;
  tool: ToolId;
  prompt: string;
  status: "working" | "done";
  modelName: string;
  credits: number;
  sample: boolean;
  startedAt: number;
  spot: SpotState;
};

type State = {
  /** The server balance, refreshed from /api/me and after every earn or spend. */
  credits: number;
  /** Whether today's first-video bonus has been claimed. */
  floorUnlocked: boolean;
  /** False until the first balance arrives from the server. */
  synced: boolean;
  /** Spending against the daily and weekly limits. Null until synced. */
  usage: Usage | null;
  /** Network country and account status, from /api/me. */
  me: { country: string | null; status: string; role?: string } | null;
  /** Profile preferences from the server. Null until loaded. */
  settings: Settings | null;
  modelId: string;
  tool: ToolId;
  jobs: Job[];
  gate: { needed: number } | null;
  earnOpen: boolean;
  sidebarOpen: boolean;
  toast: { id: number; text: string } | null;
  draft: string;
  nextId: number;
};

type Action =
  | { type: "setTool"; tool: ToolId }
  | { type: "setModel"; modelId: string }
  | { type: "setDraft"; draft: string }
  | { type: "addJob"; job: Job; cost: number }
  | { type: "finishJob"; id: string }
  | { type: "setSpot"; id: string; spot: SpotState }
  | { type: "account"; credits: number; floorUnlocked: boolean; usage: Usage; me?: State["me"]; toast?: string }
  | { type: "dropJob"; id: string; toast: string }
  | { type: "settings"; settings: Settings; first?: boolean }
  | { type: "openGate"; needed: number }
  | { type: "closeGate" }
  | { type: "setEarnOpen"; open: boolean }
  | { type: "setSidebar"; open: boolean }
  | { type: "toast"; text: string }
  | { type: "clearToast"; id: number }
  | { type: "newChat" }
  | { type: "openSampleChat" };

function sampleJob(tool: ToolId, id: string, modelName: string, credits: number): Job {
  return {
    id,
    tool,
    prompt: TOOLS[tool].sample,
    status: "done",
    modelName,
    credits,
    sample: true,
    startedAt: 0,
    spot: "idle",
  };
}

/** No free credits: everyone starts at zero and earns by watching sponsor videos. */
const initialState: State = {
  credits: 0,
  floorUnlocked: false,
  synced: false,
  usage: null,
  me: null,
  settings: null,
  modelId: "haiku",
  tool: "chat",
  jobs: [
    sampleJob("code", "seed-code", "Haiku 5.5", 3),
    sampleJob("design", "seed-design", "Sonnet 5.5", 4),
    sampleJob("images", "seed-images", IMAGE_MODEL_NAME, 3),
  ],
  gate: null,
  earnOpen: false,
  sidebarOpen: false,
  toast: null,
  draft: "",
  nextId: 1,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setTool":
      return { ...state, tool: action.tool, gate: null, sidebarOpen: false };
    case "setModel":
      return { ...state, modelId: action.modelId, gate: null };
    case "setDraft":
      return { ...state, draft: action.draft };
    case "addJob":
      return {
        ...state,
        credits: state.credits - action.cost,
        jobs: [...state.jobs, action.job],
        draft: "",
        gate: null,
        nextId: state.nextId + 1,
      };
    case "finishJob":
      return { ...state, jobs: state.jobs.map((j) => (j.id === action.id ? { ...j, status: "done" } : j)) };
    case "setSpot":
      return { ...state, jobs: state.jobs.map((j) => (j.id === action.id ? { ...j, spot: action.spot } : j)) };
    case "account":
      return {
        ...state,
        credits: action.credits,
        floorUnlocked: action.floorUnlocked,
        usage: action.usage,
        me: action.me ?? state.me,
        synced: true,
        toast: action.toast ? { id: state.nextId, text: action.toast } : state.toast,
        nextId: state.nextId + 1,
      };
    case "settings":
      // The first load also opens the workspace on the person's default tool and model.
      return action.first
        ? { ...state, settings: action.settings, modelId: action.settings.defaultModel, tool: action.settings.startIn }
        : { ...state, settings: action.settings };
    case "dropJob":
      return {
        ...state,
        jobs: state.jobs.filter((j) => j.id !== action.id),
        toast: { id: state.nextId, text: action.toast },
        nextId: state.nextId + 1,
      };
    case "openGate":
      return { ...state, gate: { needed: action.needed } };
    case "closeGate":
      return { ...state, gate: null };
    case "setEarnOpen":
      return { ...state, earnOpen: action.open };
    case "setSidebar":
      return { ...state, sidebarOpen: action.open };
    case "toast":
      return { ...state, toast: { id: state.nextId, text: action.text }, nextId: state.nextId + 1 };
    case "clearToast":
      return state.toast?.id === action.id ? { ...state, toast: null } : state;
    case "newChat":
      return { ...state, tool: "chat", jobs: state.jobs.filter((j) => j.tool !== "chat"), gate: null, sidebarOpen: false };
    case "openSampleChat": {
      const hasChat = state.jobs.some((j) => j.tool === "chat");
      return {
        ...state,
        tool: "chat",
        sidebarOpen: false,
        gate: null,
        jobs: hasChat ? state.jobs : [...state.jobs, sampleJob("chat", `seed-chat-${state.nextId}`, "Sonnet 5.5", 2)],
        nextId: state.nextId + 1,
      };
    }
  }
}

type Workspace = State & {
  dispatch: React.Dispatch<Action>;
  submit: () => void;
  /** Credits the current tool + model would charge for one job. */
  price: number;
  modelName: string;
};

/** "in 5 hr 12 min", "Mon 3:00 AM": when a limit window resets, in the viewer's time. */
export function resetLabel(iso: string, style: "relative" | "weekday"): string {
  const at = new Date(iso);
  if (style === "weekday") return at.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  const mins = Math.max(1, Math.round((at.getTime() - Date.now()) / 60000));
  const h = Math.floor(mins / 60);
  return `in ${h ? `${h} hr ` : ""}${mins % 60} min`;
}

/** The message to show when a job of this price would go over a limit, or null. */
export function limitReached(usage: Usage | null, price: number): string | null {
  if (!usage) return null;
  if (usage.dayUsed + price > usage.dayLimit) return `You've reached today's limit. It resets ${resetLabel(usage.dayResetsAt, "relative")}`;
  if (usage.weekUsed + price > usage.weekLimit) return `You've reached this week's limit. It resets ${resetLabel(usage.weekResetsAt, "weekday")}`;
  return null;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timers = useRef<number[]>([]);

  const tool = TOOLS[state.tool];
  const model = getModel(state.modelId);
  const price = jobCost(tool, model);
  const modelName = state.tool === "images" ? IMAGE_MODEL_NAME : model.name;

  const submit = useCallback(() => {
    const prompt = state.draft.trim();
    if (!prompt) return;
    const limit = limitReached(state.usage, price);
    if (limit) {
      dispatch({ type: "toast", text: limit });
      return;
    }
    if (price > state.credits) {
      dispatch({ type: "openGate", needed: price });
      return;
    }
    const id = `job-${crypto.randomUUID()}`;
    dispatch({
      type: "addJob",
      cost: price,
      job: { id, tool: state.tool, prompt, status: "working", modelName, credits: price, sample: false, startedAt: Date.now(), spot: "idle" },
    });
    // Charged on the server; the balance shown above is corrected from its answer.
    fetch("/api/spend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: state.tool, modelId: state.modelId, jobId: id }) })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (typeof b.credits === "number") dispatch({ type: "account", credits: b.credits, floorUnlocked: b.floorUnlocked, usage: b.usage });
        if (r.ok) return;
        const why = b.reason === "credits" ? "Not enough credits for that. Watch a video to earn more" : b.reason === "day" || b.reason === "week" ? limitReached(b.usage, price) : null;
        dispatch({ type: "dropJob", id, toast: why ?? "Couldn't start that. Try again" });
      })
      .catch(() => dispatch({ type: "dropJob", id, toast: "You're offline. Try again" }));
    timers.current.push(window.setTimeout(() => dispatch({ type: "finishJob", id }), tool.durationMs));
  }, [state.draft, state.credits, state.usage, state.modelId, state.tool, price, modelName, tool.durationMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!state.toast) return;
    const id = state.toast.id;
    const t = window.setTimeout(() => dispatch({ type: "clearToast", id }), 2200);
    return () => window.clearTimeout(t);
  }, [state.toast]);

  const value = useMemo(
    () => ({ ...state, dispatch, submit, price, modelName }),
    [state, submit, price, modelName],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

