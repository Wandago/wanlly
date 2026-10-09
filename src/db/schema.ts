import { sql } from "drizzle-orm";
import { bigserial, boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/* Credits are integer half-cents of model cost. Balances are never stored: they are the sum of
   ledger entries, which are only ever added, never edited or deleted (see docs/SECURITY.md). */

export const users = pgTable("users", {
  /** The Clerk user id. */
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  /** Two-letter country from the network (Cloudflare), set on first visit. Not user-editable. */
  country: text("country"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  role: text("role", { enum: ["user", "ambassador", "analyst", "support", "moderator", "admin", "owner"] })
    .notNull()
    .default("user"),
  status: text("status", { enum: ["active", "slowed", "challenged", "frozen", "banned", "deleted"] })
    .notNull()
    .default("active"),
  riskScore: integer("risk_score").notNull().default(0),
  /** Preferences from the profile page. Shape and defaults live in src/lib/settings.ts. */
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    /** Positive for credits in, negative for spending. */
    delta: integer("delta").notNull(),
    reason: text("reason", {
      enum: ["floor", "video", "survey", "sponsor_trial", "referral", "student_bonus", "admin_grant", "reserve", "settle", "release", "reversal"],
    }).notNull(),
    /** Idempotency key: an ad transaction id, a job id, etc. The same event can never post twice. */
    refId: text("ref_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ledger_ref_reason").on(t.refId, t.reason), index("ledger_user").on(t.userId, t.createdAt)],
);

/** One row per person per day once they unlock the community floor. */
export const dailyFloors = pgTable(
  "daily_floors",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    day: date("day").notNull(),
    credits: integer("credits").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("floor_user_day").on(t.userId, t.day)],
);

/** Every ad shown or completed, for revenue, rewards and fraud checks. */
export const adEvents = pgTable(
  "ad_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").references(() => users.id),
    partner: text("partner").notNull(),
    format: text("format").notNull(),
    placement: text("placement").notNull(),
    country: text("country"),
    kind: text("kind", { enum: ["impression", "click", "reward_started", "reward_completed", "reward_reversed"] }).notNull(),
    /** Which ad (the sponsor or creative name), for per-ad performance. */
    creative: text("creative"),
    /** The partner's transaction id for rewarded views. Unique, so a replayed callback is ignored. */
    transactionId: text("transaction_id"),
    /** Revenue in millionths of a US dollar, once known. */
    revenueMicros: integer("revenue_micros"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ad_txn").on(t.partner, t.transactionId).where(sql`${t.transactionId} is not null`),
    index("ad_user_time").on(t.userId, t.createdAt),
  ],
);

/** Models are rows, so a new one goes live without a code release. Prices in US dollars per million tokens. */
export const models = pgTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  apiModel: text("api_model").notNull(),
  inputPriceCents: integer("input_price_cents").notNull(),
  outputPriceCents: integer("output_price_cents").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const projects = pgTable("projects", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  tool: text("tool", { enum: ["chat", "code", "design", "images"] }).notNull(),
  about: text("about").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  modelId: text("model_id").notNull().default("haiku"),
  /** For Design projects: slides, design, codebase or system. */
  kind: text("kind", { enum: ["slides", "design", "codebase", "system"] }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Set when deleted. Rows are kept 30 days so a mistake can be undone, then purged. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("projects_owner").on(t.ownerId, t.updatedAt)]);

export const conversations = pgTable("conversations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  projectId: integer("project_id").references(() => projects.id),
  tool: text("tool", { enum: ["chat", "code", "design", "images"] }).notNull(),
  title: text("title").notNull().default("New chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: jsonb("content").notNull(),
  modelId: text("model_id"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  credits: integer("credits"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Beta applications from the public /beta page. Reviewed by hand in the admin page. */
export const betaApplications = pgTable(
  "beta_applications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    country: text("country"),
    build: text("build").notNull(),
    source: text("source"),
    referralCode: text("referral_code"),
    inviteCode: text("invite_code").notNull(),
    networkCountry: text("network_country"),
    status: text("status", { enum: ["pending", "approved", "declined"] }).notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("beta_email").on(t.email), uniqueIndex("beta_invite_code").on(t.inviteCode)],
);

/** Messages from the public contact page. */
export const contactMessages = pgTable("contact_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  networkCountry: text("network_country"),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every change made from the admin page: who did what to whom, and why. Never edited. */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    detail: jsonb("detail").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_actions_time").on(t.createdAt)],
);

/**
 * One row per page view, recorded without cookies. `visitor` is a keyed hash of the network
 * address and browser that changes every UTC day, so a visitor can't be followed across days.
 */
export const pageViews = pgTable(
  "page_views",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    country: text("country"),
    device: text("device", { enum: ["mobile", "tablet", "desktop"] }).notNull(),
    visitor: text("visitor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("page_views_time").on(t.createdAt), index("page_views_visitor").on(t.visitor)],
);

/** Which daily visitor hashes each account was seen on. Several accounts on one hash is an abuse signal. */
export const userDevices = pgTable(
  "user_devices",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    visitor: text("visitor").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_devices_pair").on(t.userId, t.visitor), index("user_devices_visitor").on(t.visitor)],
);

/** Switches the team can flip from the admin page, like pausing all earning. */
export const appFlags = pgTable("app_flags", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every generated version of a Design file. The newest is what the editor shows. */
export const designVersions = pgTable(
  "design_versions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id),
    /** What the person asked for in this version. */
    prompt: text("prompt").notNull(),
    html: text("html").notNull(),
    modelId: text("model_id").notNull(),
    credits: integer("credits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("design_versions_project").on(t.projectId, t.id)],
);
