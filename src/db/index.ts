import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let client: ReturnType<typeof drizzle<typeof schema>> | null = null;
let raw: ReturnType<typeof neon> | null = null;

function url() {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error("DATABASE_URL is not set. See .env.example.");
  return u;
}

/** The database, created on first use so pages that don't need it work without DATABASE_URL. */
export function db() {
  if (!client) client = drizzle(neon(url()), { schema });
  return client;
}

/** Plain SQL, for the few statements that must run together in one transaction. */
export function rawSql() {
  raw ??= neon(url());
  return raw;
}

export { schema };
