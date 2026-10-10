import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
  /** When this person's current 6-hour usage session began (their first spend in it). */
  sessionStartedAt: timestamp("session_started_at", { withTimezone: true }),
  /** When this person's current 7-day usage week began. */
  weekStartedAt: timestamp("week_started_at", { withTimezone: true }),
  /** What Wanlly remembers about this person (see src/lib/memory.ts); null until there's something. */
  memory: jsonb("memory"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Phone numbers proven over WhatsApp, one account each. Only a hash of the number is kept: enough
 * to stop a second account using it, not enough to message anyone.
 */
export const phoneLinks = pgTable("phone_links", {
  phoneHash: text("phone_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Short codes a person sends to Wanlly's WhatsApp number to prove their phone. Good for 30 minutes. */
export const whatsappCodes = pgTable("whatsapp_codes", {
  code: text("code").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    index("ad_creative_kind").on(t.creative, t.kind),
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
  kind: text("kind", { enum: ["slides", "design", "codebase", "system", "build"] }),
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
    /** utm tags, referring site and landing page from their first visit. */
    firstTouch: jsonb("first_touch"),
    /** The channel worked out from firstTouch, for grouping: TikTok, Search, Direct… */
    channel: text("channel"),
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

/** Businesses applying to advertise, from the public /advertise page. Reviewed in Admin. */
export const advertiserApplications = pgTable("advertiser_applications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  company: text("company").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  country: text("country"),
  category: text("category").notNull(),
  budget: text("budget"),
  formats: jsonb("formats").notNull().default([]),
  message: text("message").notNull().default(""),
  networkCountry: text("network_country"),
  status: text("status", { enum: ["pending", "approved", "declined"] }).notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Directly sold ads. An active campaign is shown in the placements it's booked for, to people
 * in its countries (all when empty), between its dates, until it reaches its impressions.
 * Ad events record it as creative "campaign:<id>".
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    applicationId: integer("application_id").references(() => advertiserApplications.id),
    advertiser: text("advertiser").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["draft", "active", "paused", "ended"] }).notNull().default("draft"),
    headline: text("headline").notNull(),
    body: text("body").notNull().default(""),
    cta: text("cta").notNull().default("Learn more"),
    url: text("url").notNull(),
    color: text("color").notNull().default("#2a78d6"),
    cover: text("cover"),
    /** Optional picture for the card, as a small data URL (uploaded in Admin). */
    image: text("image"),
    /** Banner pictures by standard size, e.g. {"300x250": "data:image/webp;base64,…"}, for display slots. */
    banners: jsonb("banners").notNull().default({}),
    placements: jsonb("placements").notNull().default([]),
    countries: jsonb("countries").notNull().default([]),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    maxImpressions: integer("max_impressions"),
    /** Most times one person sees it in a day; null for no limit. */
    frequencyCap: integer("frequency_cap"),
    /** Agreed price in US cents per 1,000 impressions, for revenue. */
    cpmCents: integer("cpm_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_status").on(t.status)],
);

/** Pictures made in Images, kept as small WebP data URLs (made in the browser from the model's PNG). */
export const images = pgTable(
  "images",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    credits: integer("credits").notNull().default(0),
    /** The job id it was paid with, so each paid job saves once. */
    refId: text("ref_id").notNull(),
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("images_user").on(t.userId, t.createdAt), uniqueIndex("images_ref").on(t.refId)],
);

/** The Builder's project files (src/lib/build.ts): one row per file, edited by the AI step by step. */
export const buildFiles = pgTable(
  "build_files",
  {
    projectId: bigint("project_id", { mode: "number" })
      .notNull()
      .references(() => projects.id),
    path: text("path").notNull(),
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "build_files_pk", columns: [t.projectId, t.path] })],
);

/**
 * The Builder's conversation, exactly as sent to the model: a person's message, the model's
 * reply (text, thinking and file edits) and the edit results. Kept verbatim, in order, so the
 * next step can continue it and reuse the cache.
 */
export const buildSteps = pgTable(
  "build_steps",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: bigint("project_id", { mode: "number" })
      .notNull()
      .references(() => projects.id),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: jsonb("content").notNull(),
    modelId: text("model_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    credits: integer("credits"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("build_steps_project").on(t.projectId, t.id)],
);

/** Builder apps published at /s/<slug>: one page per project, served sandboxed (app/s/[slug]). */
export const publishedSites = pgTable("published_sites", {
  slug: text("slug").primaryKey(),
  projectId: bigint("project_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => projects.id),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  html: text("html").notNull(),
  /** Taken down by the team (a report, or the owner's account paused). */
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
