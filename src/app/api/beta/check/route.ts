import { rawSql } from "@/db";
import { smallJson } from "@/lib/forms";
import { SAY } from "@/lib/messages";

/**
 * Before sign-up: is Wanlly open to everyone, and if not, where does this email stand in the
 * beta? Only says approved / waiting / not applied, never anything else about the application.
 */
export async function POST(req: Request) {
  const data = await smallJson(req);
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase().slice(0, 200) : "";
  try {
    const q = rawSql();
    const [r] = (await q`
      select coalesce((select value = 'true'::jsonb from app_flags where key = 'signupOpen'), false) as open,
        (select status from beta_applications where lower(email) = ${email} order by (status = 'approved') desc, created_at desc limit 1) as status`) as {
      open: boolean;
      status: string | null;
    }[];
    if (r.open) return Response.json({ open: true });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ open: false });
    return Response.json({ open: false, status: r.status === "approved" ? "approved" : r.status ? "waiting" : "none" });
  } catch (e) {
    console.error("beta check failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}
