import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let client: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** The database, created on first use so pages that don't need it work without DATABASE_URL. */
export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
    client = drizzle(neon(url), { schema });
  }
  return client;
}

export { schema };
