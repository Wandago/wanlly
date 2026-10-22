import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { agentSettings, auditLog, integrations, members, orgs } from "@/db/schema";
import { AGENTS, CONNECTIONS, CURRENT_PHASE, type AgentId, type IntegrationKind } from "./catalog";

export type SetupStep = { id: string; label: string; done: boolean; available: boolean };

export type ConnectionCard = {
  kind: IntegrationKind;
  name: string;
  state: "live" | "waiting" | "error" | "off" | "soon";
  detail: string;
};

export type AgentRow = {
  id: AgentId;
  name: string;
  initials: string;
  sends: string;
  available: boolean;
  enabled: boolean;
};

export type ActivityRow = { seq: number; at: string; actor: string; text: string };

export type Overview = {
  shop: { name: string; town: string | null };
  steps: SetupStep[];
  connections: ConnectionCard[];
  agents: AgentRow[];
  activity: ActivityRow[];
};

type IntegrationRow = { kind: IntegrationKind; label: string; status: string };

const MONEY_KINDS: IntegrationKind[] = ["daraja_paybill", "daraja_till", "sms_forward"];

export function buildSteps(input: { phoneVerified: boolean; integrations: IntegrationRow[] }): SetupStep[] {
  const active = (kinds: IntegrationKind[]) =>
    input.integrations.some((i) => kinds.includes(i.kind) && i.status === "active");
  return [
    { id: "shop", label: "Create your shop", done: true, available: true },
    { id: "whatsapp", label: "Verify your WhatsApp number", done: input.phoneVerified, available: CURRENT_PHASE >= 1 },
    { id: "rules", label: "Review what your cadre may do on its own", done: false, available: CURRENT_PHASE >= 1 },
    { id: "money", label: "Connect how you get paid", done: active(MONEY_KINDS), available: CURRENT_PHASE >= 2 },
    { id: "bank", label: "Forward bank alert emails", done: active(["email_forward"]), available: CURRENT_PHASE >= 5 },
  ];
}

export function buildConnections(rows: IntegrationRow[]): ConnectionCard[] {
  return CONNECTIONS.map((c) => {
    const mine = rows.filter((r) => r.kind === c.kind);
    const label = (r: IntegrationRow) => (r.label ? `${c.name} ${r.label}` : c.name);
    const live = mine.find((r) => r.status === "active");
    if (live) return { kind: c.kind, name: label(live), state: "live", detail: "Connected" };
    const failing = mine.find((r) => r.status === "error");
    if (failing) return { kind: c.kind, name: label(failing), state: "error", detail: "Needs attention" };
    const pending = mine.find((r) => r.status === "pending");
    if (pending) return { kind: c.kind, name: label(pending), state: "waiting", detail: "Setting up" };
    if (c.phase > CURRENT_PHASE) return { kind: c.kind, name: c.name, state: "soon", detail: c.pitch };
    return { kind: c.kind, name: c.name, state: "off", detail: c.pitch };
  });
}

export function buildAgents(rows: { agent: AgentId; enabled: boolean }[]): AgentRow[] {
  return AGENTS.map((a) => ({
    ...a,
    enabled: a.available && (rows.find((r) => r.agent === a.id)?.enabled ?? false),
  }));
}

const ACTIONS: Record<string, (data: Record<string, unknown>) => string> = {
  "shop.created": (d) => `created the shop${typeof d.name === "string" ? ` ${d.name}` : ""}`,
  "shop.updated": () => "updated the shop details",
  "agent.enabled": (d) => `turned on ${agentName(d.agent)}`,
  "agent.disabled": (d) => `turned off ${agentName(d.agent)}`,
  "member.joined": () => "joined the shop",
};

function agentName(id: unknown): string {
  return AGENTS.find((a) => a.id === id)?.name ?? "an agent";
}

export function describeAudit(row: { action: string; data: unknown }): string {
  const data = (row.data && typeof row.data === "object" ? row.data : {}) as Record<string, unknown>;
  return ACTIONS[row.action]?.(data) ?? row.action;
}

// Every query names the shop as well as relying on row-level security, so a mistake in
// one layer is caught by the other.
export async function listActivity(db: Db, orgId: string, limit: number): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      seq: auditLog.seq,
      createdAt: auditLog.createdAt,
      actorType: auditLog.actorType,
      action: auditLog.action,
      data: auditLog.data,
    })
    .from(auditLog)
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.seq))
    .limit(limit);
  return rows.map((r) => ({
    seq: r.seq,
    at: r.createdAt.toISOString(),
    actor: r.actorType === "member" ? "You" : r.actorType === "agent" ? "Cadre" : "System",
    text: describeAudit(r),
  }));
}

export async function loadOverview(db: Db, orgId: string, clerkUserId: string): Promise<Overview> {
  const [shop] = await db.select({ name: orgs.name, town: orgs.town }).from(orgs).where(eq(orgs.id, orgId));
  const [me] = await db
    .select({ phoneVerifiedAt: members.phoneVerifiedAt })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.clerkUserId, clerkUserId)));
  const integrationRows = await db
    .select({ kind: integrations.kind, label: integrations.label, status: integrations.status })
    .from(integrations)
    .where(eq(integrations.orgId, orgId));
  const agentRows = await db
    .select({ agent: agentSettings.agent, enabled: agentSettings.enabled })
    .from(agentSettings)
    .where(eq(agentSettings.orgId, orgId));

  return {
    shop,
    steps: buildSteps({ phoneVerified: Boolean(me?.phoneVerifiedAt), integrations: integrationRows }),
    connections: buildConnections(integrationRows),
    agents: buildAgents(agentRows),
    activity: await listActivity(db, orgId, 6),
  };
}
