import "server-only";
import { rawSql } from "@/db";

/*
 * Which migrations in drizzle/ have run on this database, judged by a table or column each one
 * adds, and a readable message for a database error instead of "Database unavailable".
 */

const MARKS = [
  { file: "0001_beta_and_contact", table: "beta_applications", column: "id" },
  { file: "0002_profile_and_projects", table: "projects", column: "about" },
  { file: "0003_admin", table: "admin_actions", column: "id" },
  { file: "0004_traffic_and_ads", table: "app_flags", column: "key" },
  { file: "0005_design_kind", table: "projects", column: "kind" },
  { file: "0006_design_versions", table: "design_versions", column: "id" },
  { file: "0007_advertisers", table: "campaigns", column: "id" },
  { file: "0008_beta_first_touch", table: "beta_applications", column: "first_touch" },
  { file: "0009_campaign_frequency_cap", table: "campaigns", column: "frequency_cap" },
  { file: "0010_images", table: "images", column: "id" },
  { file: "0011_usage_sessions", table: "users", column: "session_started_at" },
  { file: "0012_campaign_banners", table: "campaigns", column: "banners" },
  { file: "0013_user_memory", table: "users", column: "memory" },
  { file: "0014_design_tokens", table: "design_versions", column: "input_tokens" },
  { file: "0015_ad_creative_index", table: "ad_events", column: "", index: "ad_creative_kind" },
  { file: "0016_whatsapp_verify", table: "phone_links", column: "phone_hash" },
  { file: "0017_builder", table: "build_steps", column: "id" },
] as { file: string; table: string; column: string; index?: string }[];

/** Every migration with whether its table or column exists. */
export async function migrationStatus() {
  const rows = (await rawSql()`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`) as { table_name: string; column_name: string }[];
  const indexes = (await rawSql()`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`) as { indexname: string }[];
  const have = new Set([...rows.map((r) => `${r.table_name}.${r.column_name}`), ...indexes.map((i) => `index:${i.indexname}`)]);
  return MARKS.map((m) => ({ file: `${m.file}.sql`, applied: have.has(m.index ? `index:${m.index}` : `${m.table}.${m.column}`) }));
}

/** The Postgres error under Drizzle's wrapper, which otherwise only says "Failed query: <sql>". */
function pgError(e: unknown): { code?: string; message: string } {
  let x = e as { cause?: unknown; code?: string; message?: string } | undefined;
  while (x?.cause && typeof x.cause === "object") x = x.cause as typeof x;
  return { code: x?.code, message: String(x?.message ?? e) };
}

/**
 * What staff should see when a save fails: the migration to run when a column or table is
 * missing, otherwise the database's own message (admin routes only; it can include SQL).
 */
export function dbErrorMessage(e: unknown) {
  const { code, message } = pgError(e);
  const col = /column "([^"]+)"(?: of relation "([^"]+)")? does not exist/.exec(message);
  const tbl = /relation "([^"]+)" does not exist/.exec(message);
  if (code === "42703" || code === "42P01" || col || tbl) {
    const m = col ? MARKS.find((k) => !k.index && k.column === col[1] && (!col[2] || k.table === col[2])) : tbl ? MARKS.find((k) => k.table === tbl[1]) : undefined;
    if (m) return `The database is missing migration ${m.file}.sql. Run it in Neon's SQL editor, then try again.`;
  }
  return `Database error: ${message.slice(0, 300)}`;
}
