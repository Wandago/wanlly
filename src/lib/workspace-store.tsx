"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
  CHEAPEST_MODEL_ID,
  IMAGE_MODEL_NAME,
  MODELS,
  TOOLS,
  getModel,
  isLive,
  jobCost,
  type Providers,
  type ToolId,
  type Usage,
} from "./catalog";
import { forSending, type Attachment } from "./attach";
import type { Settings } from "./settings";

/*
 * The workspace's state. Credits live on the server (the ledger). Chat and Code send real
 * messages and stream replies; Design and Images show samples until their models are connected.
 */

export type SpotState = "idle" | "playing" | "earned";

export type Job = {
  id: string;
  tool: ToolId;
  prompt: string;
  status: "working" | "done" | "error";
  modelName: string;
  /** Upfront price while working; what was actually charged once done. */
  credits: number;
  sample: boolean;
  startedAt: number;
  spot: SpotState;
  /** The reply so far, for real Chat and Code jobs. */
  text?: string;
  error?: string;
  /** "max_tokens" or "interrupted" when the reply was cut short. */
  stop?: string;
  /** Files sent with the prompt. Their contents stay in memory only, for Ask again. */
  files?: Attachment[];
};

export type Recent = { id: number; title: string; tool: string; projectId: number | null };

/** Text tools are connected to real models; the others are design samples for now. */
export const isConnected = (tool: ToolId) => tool === "chat" || tool === "code";

type State = {
  /** The server balance, refreshed from /api/me and after every earn or spend. */
  credits: number;
  /** Whether today's first-video bonus has been claimed. */
  floorUnlocked: boolean;
  /** False until the first balance arrives from the server. */
  synced: boolean;
  /** Spending against the daily and weekly limits. Null until synced. */
  usage: Usage | null;
  /** Network country, account status and role, from /api/me. */
  me: { country: string | null; status: string; role?: string } | null;
  /** Which model providers have keys. Null until synced. */
  providers: Providers | null;
  /** Profile preferences from the server. Null until loaded. */
  settings: Settings | null;
  modelId: string;
  tool: ToolId;
  jobs: Job[];
  /** The open conversation, once its first message is sent. */
  conversationId: number | null;
  /** The project a new conversation starts in, if any. */
  projectId: number | null;
  recents: Recent[] | null;
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
  | { type: "jobText"; id: string; text: string }
  | { type: "jobDone"; id: string; charged: number; stop: string }
  | { type: "jobError"; id: string; message: string }
  | { type: "setSpot"; id: string; spot: SpotState }
  | { type: "account"; credits: number; floorUnlocked: boolean; usage: Usage; me?: State["me"]; providers?: Providers; toast?: string }
  | { type: "dropJob"; id: string; toast: string }
  | { type: "settings"; settings: Settings; first?: boolean }
  | { type: "conversation"; id: number }
  | { type: "openConversation"; id: number; tool: ToolId; jobs: Job[] }
  | { type: "recents"; recents: Recent[] }
  | { type: "openGate"; needed: number }
  | { type: "closeGate" }
  | { type: "setEarnOpen"; open: boolean }
  | { type: "setSidebar"; open: boolean }
  | { type: "toast"; text: string }
  | { type: "clearToast"; id: number }
  | { type: "newChat"; tool?: ToolId; projectId?: number | null };

function sampleJob(tool: ToolId, id: string, modelName: string, credits: number): Job {
  return { id, tool, prompt: TOOLS[tool].sample, status: "done", modelName, credits, sample: true, startedAt: 0, spot: "idle" };
}

const patchJob = (state: State, id: string, patch: (j: Job) => Partial<Job>): State => ({
  ...state,
  jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...patch(j) } : j)),
});

/** A model the person can use now: the one asked for if it's live, else the free starter. */
function liveModel(modelId: string, providers: Providers | null) {
  const m = MODELS.find((x) => x.id === modelId);
  return m && isLive(m, providers) ? m.id : CHEAPEST_MODEL_ID;
}

/** No free credits: everyone starts at zero and earns by watching sponsor videos. */
const initialState: State = {
  credits: 0,
  floorUnlocked: false,
  synced: false,
  usage: null,
  me: null,
  providers: null,
  settings: null,
  modelId: CHEAPEST_MODEL_ID,
  tool: "chat",
  jobs: [sampleJob("design", "seed-design", "Sonnet 5.5", 4), sampleJob("images", "seed-images", IMAGE_MODEL_NAME, 3)],
  conversationId: null,
  projectId: null,
  recents: null,
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
      return { ...state, modelId: liveModel(action.modelId, state.providers), gate: null };
    case "setDraft":
      return { ...state, draft: action.draft };
    case "addJob":
      return { ...state, credits: state.credits - action.cost, jobs: [...state.jobs, action.job], draft: "", gate: null, nextId: state.nextId + 1 };
    case "finishJob":
      return patchJob(state, action.id, () => ({ status: "done" }));
    case "jobText":
      return patchJob(state, action.id, (j) => ({ text: (j.text ?? "") + action.text }));
    case "jobDone":
      return patchJob(state, action.id, () => ({ status: "done", credits: action.charged, stop: action.stop }));
    case "jobError":
      return patchJob(state, action.id, () => ({ status: "error", error: action.message, credits: 0 }));
    case "setSpot":
      return patchJob(state, action.id, () => ({ spot: action.spot }));
    case "account": {
      const providers = action.providers ?? state.providers;
      return {
        ...state,
        credits: action.credits,
        floorUnlocked: action.floorUnlocked,
        usage: action.usage,
        me: action.me ?? state.me,
        providers,
        modelId: liveModel(state.modelId, providers),
        synced: true,
        toast: action.toast ? { id: state.nextId, text: action.toast } : state.toast,
        nextId: state.nextId + 1,
      };
    }
    case "settings":
      // The first load also opens the workspace on the person's default tool and model.
      return action.first
        ? { ...state, settings: action.settings, modelId: liveModel(action.settings.defaultModel, state.providers), tool: action.settings.startIn }
        : { ...state, settings: action.settings };
    case "dropJob":
      return { ...state, jobs: state.jobs.filter((j) => j.id !== action.id), toast: { id: state.nextId, text: action.toast }, nextId: state.nextId + 1 };
    case "conversation":
      return { ...state, conversationId: action.id };
    case "openConversation":
      return {
        ...state,
        tool: action.tool,
        conversationId: action.id,
        projectId: null,
        jobs: [...state.jobs.filter((j) => !isConnected(j.tool)), ...action.jobs],
        gate: null,
        sidebarOpen: false,
      };
    case "recents":
      return { ...state, recents: action.recents };
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
      return {
        ...state,
        tool: action.tool ?? (isConnected(state.tool) ? state.tool : "chat"),
        conversationId: null,
        projectId: action.projectId ?? null,
        jobs: state.jobs.filter((j) => !isConnected(j.tool)),
        gate: null,
        sidebarOpen: false,
      };
  }
}

type Workspace = State & {
  dispatch: React.Dispatch<Action>;
  submit: (files?: Attachment[]) => void;
  /** Stops a reply that's still streaming. */
  stop: (jobId: string) => void;
  /** Sends a job's prompt again as a new message. */
  retry: (job: Job) => void;
  openConversation: (id: number) => Promise<void>;
  refreshRecents: () => void;
  /** Credits the current tool + model would charge for one job, at least. */
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

type Body = { credits?: number; floorUnlocked?: boolean; usage?: Usage };
const accountFrom = (b: Body): Action | null =>
  typeof b.credits === "number" && b.usage ? { type: "account", credits: b.credits, floorUnlocked: !!b.floorUnlocked, usage: b.usage } : null;

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timers = useRef<number[]>([]);
  const streams = useRef(new Map<string, AbortController>());
  // Read inside async callbacks, so a reply that finishes later sees current state.
  const live = useRef(state);
  useEffect(() => {
    live.current = state;
  });

  const tool = TOOLS[state.tool];
  const model = getModel(state.modelId);
  const price = jobCost(tool, model);
  const modelName = state.tool === "images" ? IMAGE_MODEL_NAME : model.name;

  const refreshRecents = useCallback(() => {
    fetch("/api/conversations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && dispatch({ type: "recents", recents: b.conversations }))
      .catch(() => {});
  }, []);

  /** Streams one reply from /api/chat into the job. */
  const run = useCallback(
    async (id: string, body: object) => {
      const ctrl = new AbortController();
      streams.current.set(id, ctrl);
      let gotText = false;
      try {
        const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
        if (!r.ok || !r.body) {
          const b = await r.json().catch(() => ({}));
          const acct = accountFrom(b);
          if (acct) dispatch(acct);
          const why =
            b.reason === "credits"
              ? "Not enough credits for that. Watch a video to earn more"
              : b.reason === "day" && b.usage
                ? `You've reached today's limit. It resets ${resetLabel(b.usage.dayResetsAt, "relative")}`
                : b.reason === "week" && b.usage
                  ? `You've reached this week's limit. It resets ${resetLabel(b.usage.weekResetsAt, "weekday")}`
                  : b.error;
          dispatch({ type: "dropJob", id, toast: why ?? "Couldn't send that. Try again" });
          return;
        }
        const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line);
            if (ev.type === "start") {
              if (live.current.conversationId !== ev.conversationId) {
                dispatch({ type: "conversation", id: ev.conversationId });
                refreshRecents();
              }
            } else if (ev.type === "text") {
              gotText = true;
              dispatch({ type: "jobText", id, text: ev.text });
            } else if (ev.type === "done") {
              dispatch({ type: "jobDone", id, charged: ev.charged, stop: ev.stop });
              const acct = accountFrom(ev);
              if (acct) dispatch(acct);
            } else if (ev.type === "error") {
              dispatch({ type: "jobError", id, message: ev.message });
              const acct = accountFrom(ev);
              if (acct) dispatch(acct);
            }
          }
        }
      } catch (e) {
        const stopped = e instanceof Error && e.name === "AbortError";
        if (stopped && gotText) dispatch({ type: "jobDone", id, charged: live.current.jobs.find((j) => j.id === id)?.credits ?? 0, stop: "interrupted" });
        else dispatch({ type: "jobError", id, message: stopped ? "Stopped before the reply started. Your credits were refunded." : "Connection lost. If no reply arrived, your credits were refunded." });
        // The server settles either way; fetch the true balance.
        fetch("/api/me", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((b) => {
            const acct = b && accountFrom(b);
            if (acct) dispatch(acct);
          })
          .catch(() => {});
      } finally {
        streams.current.delete(id);
      }
    },
    [refreshRecents],
  );

  const send = useCallback(
    (prompt: string, toolId: ToolId, files: Attachment[] = []) => {
      const s = live.current;
      const m = getModel(s.modelId);
      const cost = jobCost(TOOLS[toolId], m);
      if (!isConnected(toolId)) {
        dispatch({ type: "toast", text: `${TOOLS[toolId].label} is coming soon. Chat and Code work today` });
        return;
      }
      const limit = limitReached(s.usage, cost);
      if (limit) return dispatch({ type: "toast", text: limit });
      if (cost > s.credits) return dispatch({ type: "openGate", needed: cost });
      const id = `job-${crypto.randomUUID()}`;
      dispatch({
        type: "addJob",
        cost,
        job: { id, tool: toolId, prompt, status: "working", modelName: m.name, credits: cost, sample: false, startedAt: Date.now(), spot: "idle", text: "", files },
      });
      run(id, {
        message: prompt,
        tool: toolId,
        modelId: m.id,
        jobId: id,
        conversationId: s.conversationId,
        projectId: s.conversationId ? null : s.projectId,
        attachments: forSending(files.filter((f) => f.data || f.text)),
      });
    },
    [run],
  );

  const submit = useCallback(
    (files: Attachment[] = []) => {
      const prompt = live.current.draft.trim();
      if (prompt || files.length) send(prompt, live.current.tool, files);
    },
    [send],
  );

  const retry = useCallback((job: Job) => send(job.prompt, job.tool, job.files), [send]);
  const stop = useCallback((jobId: string) => streams.current.get(jobId)?.abort(), []);

  const openConversation = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const { conversation, messages } = (await r.json()) as {
        conversation: { id: number; tool: ToolId };
        messages: { id: number; role: "user" | "assistant"; text: string; stop: string | null; modelId: string | null; credits: number | null; createdAt: string; attachments?: { name: string; mime: string; size: number }[] }[];
      };
      // Pair each message with the reply that followed it.
      const jobs: Job[] = [];
      for (const msg of messages) {
        if (msg.role === "user") {
          jobs.push({
            id: `m-${msg.id}`,
            tool: conversation.tool,
            prompt: msg.text,
            status: "error",
            error: "No reply was saved for this message.",
            modelName: "",
            credits: 0,
            sample: false,
            startedAt: 0,
            spot: "idle",
            // Only the names were saved; the files themselves aren't kept.
            files: msg.attachments?.map((a, i) => ({ ...a, id: `${msg.id}-${i}` })),
          });
        } else {
          const last = jobs[jobs.length - 1];
          if (last && last.status === "error") {
            Object.assign(last, { status: "done", error: undefined, text: msg.text, stop: msg.stop ?? undefined, credits: msg.credits ?? 0, modelName: msg.modelId ? getModel(msg.modelId).name : "" });
          }
        }
      }
      dispatch({ type: "openConversation", id: conversation.id, tool: conversation.tool, jobs });
    } catch {
      dispatch({ type: "toast", text: "Couldn't open that conversation" });
    }
  }, []);

  useEffect(() => {
    const pending = timers.current;
    const open = streams.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      open.forEach((c) => c.abort());
    };
  }, []);

  useEffect(() => {
    if (!state.toast) return;
    const id = state.toast.id;
    const t = window.setTimeout(() => dispatch({ type: "clearToast", id }), 2600);
    return () => window.clearTimeout(t);
  }, [state.toast]);

  const value = useMemo(
    () => ({ ...state, dispatch, submit, stop, retry, openConversation, refreshRecents, price, modelName }),
    [state, submit, stop, retry, openConversation, refreshRecents, price, modelName],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
