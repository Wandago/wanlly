"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
  FLOOR_CREDITS,
  IMAGE_MODEL_NAME,
  TOOLS,
  getModel,
  jobCost,
  type ToolId,
} from "./catalog";

/* Front-end only: jobs are simulated with timers until the backend lands (Phase 3). */

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
  credits: number;
  /** Today's community floor. Locked until the first video of the day. */
  floorUnlocked: boolean;
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
  | { type: "earn"; amount: number; note?: string }
  | { type: "unlockFloor" }
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

/** No free credits: everyone starts at zero and unlocks the day with one video. */
const initialState: State = {
  credits: 0,
  floorUnlocked: false,
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
    case "earn":
      return {
        ...state,
        credits: state.credits + action.amount,
        toast: { id: state.nextId, text: `+${action.amount} credits${action.note ? ` · ${action.note}` : ""}` },
        nextId: state.nextId + 1,
      };
    case "unlockFloor":
      return state.floorUnlocked
        ? state
        : {
            ...state,
            floorUnlocked: true,
            credits: state.credits + FLOOR_CREDITS,
            toast: { id: state.nextId, text: `Today's floor unlocked · +${FLOOR_CREDITS} credits` },
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
    if (price > state.credits) {
      dispatch({ type: "openGate", needed: price });
      return;
    }
    const id = `job-${state.nextId}`;
    dispatch({
      type: "addJob",
      cost: price,
      job: { id, tool: state.tool, prompt, status: "working", modelName, credits: price, sample: false, startedAt: Date.now(), spot: "idle" },
    });
    timers.current.push(window.setTimeout(() => dispatch({ type: "finishJob", id }), tool.durationMs));
  }, [state.draft, state.credits, state.nextId, state.tool, price, modelName, tool.durationMs]);

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

