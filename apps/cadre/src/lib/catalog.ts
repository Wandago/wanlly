// What Cadre can do, independent of any one shop. Each entry says whether it's built yet,
// so the console never shows a button for something that doesn't exist.

export type AgentId = "chief" | "finance" | "inbox" | "operations" | "people" | "marketing" | "legal";

export type AgentInfo = {
  id: AgentId;
  name: string;
  initials: string;
  /** What this agent sends the owner on WhatsApp. */
  sends: string;
  available: boolean;
};

export const AGENTS: readonly AgentInfo[] = [
  { id: "chief", name: "Chief", initials: "CH", sends: "Morning brief, and at most 6 pings a day", available: true },
  { id: "finance", name: "Finance", initials: "FI", sends: "Payments as they land, debts that are late, end-of-day totals", available: true },
  { id: "inbox", name: "Inbox", initials: "IN", sends: "Bank movements and supplier invoices from forwarded email", available: true },
  { id: "operations", name: "Operations", initials: "OP", sends: "Low stock and restock orders", available: false },
  { id: "people", name: "People", initials: "PE", sends: "Payroll and KRA deadlines", available: false },
  { id: "marketing", name: "Marketing", initials: "MK", sends: "Promos for slow days", available: false },
  { id: "legal", name: "Legal", initials: "LE", sends: "Lease and licence renewals", available: false },
];

export const AGENT_IDS = AGENTS.map((a) => a.id);

export type IntegrationKind =
  | "whatsapp"
  | "daraja_paybill"
  | "daraja_till"
  | "sms_forward"
  | "statement"
  | "email_forward"
  | "jenga";

export type ConnectionInfo = {
  kind: IntegrationKind;
  name: string;
  /** Shown when nothing is connected yet. */
  pitch: string;
  /** The build phase that brings it, from docs/cadre/ARCHITECTURE.md. */
  phase: number;
};

export const CONNECTIONS: readonly ConnectionInfo[] = [
  { kind: "whatsapp", name: "WhatsApp", pitch: "Where your cadre talks to you", phase: 1 },
  { kind: "sms_forward", name: "Personal line or Pochi", pitch: "Forward M-Pesa messages to Cadre", phase: 2 },
  { kind: "statement", name: "M-Pesa statement", pitch: "Upload monthly to catch anything missed", phase: 2 },
  { kind: "daraja_till", name: "Till (Buy Goods)", pitch: "Payments the moment they land", phase: 4 },
  { kind: "daraja_paybill", name: "Paybill", pitch: "Payments the moment they land", phase: 4 },
  { kind: "email_forward", name: "Bank alerts", pitch: "Forward your bank's alert emails", phase: 5 },
  { kind: "jenga", name: "Equity Bank", pitch: "Balances and statements, direct", phase: 5 },
];

/** The phase this build has reached. Anything later shows as "coming soon". */
export const CURRENT_PHASE = 0;
