// Typed view of the tables created in db/migrations. The SQL files are the source of
// truth (they also hold the row-level security policies and grants); keep this in step.
import { bigint, boolean, jsonb, pgTable, primaryKey, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey(),
  clerkOrgId: text("clerk_org_id").notNull(),
  name: text("name").notNull(),
  town: text("town"),
  timezone: text("timezone").notNull(),
  plan: text("plan").notNull(),
  dailyAiBudgetCents: integer("daily_ai_budget_cents").notNull(),
  inboundEmailSlug: text("inbound_email_slug"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  role: text("role", { enum: ["owner", "manager", "viewer"] }).notNull(),
  displayName: text("display_name"),
  whatsappPhone: text("whatsapp_phone"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  kind: text("kind", {
    enum: ["whatsapp", "daraja_paybill", "daraja_till", "sms_forward", "statement", "email_forward", "jenga"],
  }).notNull(),
  label: text("label").notNull().default(""),
  status: text("status", { enum: ["pending", "active", "error", "disabled"] }).notNull().default("pending"),
  config: jsonb("config").notNull().default({}),
  credentialRef: uuid("credential_ref"),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentSettings = pgTable(
  "agent_settings",
  {
    orgId: uuid("org_id").notNull(),
    agent: text("agent", {
      enum: ["chief", "finance", "inbox", "operations", "people", "marketing", "legal"],
    }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    settings: jsonb("settings").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.agent] })],
);

export const events = pgTable("events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orgId: uuid("org_id").notNull(),
  type: text("type").notNull(),
  source: text("source").notNull(),
  sourceRef: text("source_ref").notNull(),
  payload: jsonb("payload").notNull().default({}),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// seq, created_at, prev_hash and hash are set by the database trigger; never pass them.
export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orgId: uuid("org_id").notNull(),
  seq: bigint("seq", { mode: "number" }).notNull().default(0),
  actorType: text("actor_type", { enum: ["member", "agent", "system"] }).notNull(),
  actorId: text("actor_id").notNull().default(""),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  prevHash: text("prev_hash"),
  hash: text("hash").notNull().default(""),
});

export const schema = { orgs, members, integrations, agentSettings, events, auditLog };
