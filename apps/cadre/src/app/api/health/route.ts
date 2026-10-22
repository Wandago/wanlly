import pg from "pg";

// Liveness for uptime checks. Reports whether the database answers, nothing else.
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ ok: false, db: "not configured" }, { status: 503 });
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("select 1");
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  } finally {
    await client.end().catch(() => {});
  }
}
