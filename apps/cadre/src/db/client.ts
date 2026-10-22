import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "./schema";

export type Db = NodePgDatabase<typeof schema>;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See apps/cadre/.env.example.");
  return url;
}

// One connection per call. On Cloudflare Workers a connection can't outlive the request,
// and Neon pools on its side, so this is the simplest correct shape for both runtimes.
async function withClient<T>(fn: (client: pg.Client) => Promise<T>, url = connectionString()): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Runs fn in a transaction scoped to one shop. Row-level security in Postgres then
 * limits every query to that shop's rows, whatever the query itself says.
 */
export async function withOrg<T>(orgId: string, fn: (db: Db) => Promise<T>, url?: string): Promise<T> {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query("select set_config('app.org_id', $1, true)", [orgId]);
      const result = await fn(drizzle(client, { schema }));
      await client.query("commit");
      return result;
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }, url);
}

/** Finds the shop for a Clerk organisation, creating it (with default agents) on first use. */
export async function ensureOrg(
  input: { clerkOrgId: string; name: string; actorId: string },
  url?: string,
): Promise<string> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string }>("select ensure_org($1, $2, $3) as id", [
      input.clerkOrgId,
      input.name,
      input.actorId,
    ]);
    return rows[0].id;
  }, url);
}

/** The shop id for a Clerk organisation, or null if Cadre hasn't seen it yet. */
export async function findOrgId(clerkOrgId: string, url?: string): Promise<string | null> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string | null }>("select org_id_for_clerk($1) as id", [clerkOrgId]);
    return rows[0].id;
  }, url);
}
