import { CAN, requireStaff } from "@/lib/admin";
import { dbErrorMessage, migrationStatus } from "@/lib/migrations";

/** Which database migrations have run, so a missing one shows up before a save fails. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.switches);
  if (staff instanceof Response) return staff;
  try {
    return Response.json({ migrations: await migrationStatus() });
  } catch (e) {
    return Response.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}
