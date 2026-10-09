import { CAN, requireStaff } from "@/lib/admin";
import { checkProviders } from "@/lib/ai";

/** Runs one tiny real request against each model provider and reports what came back. */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.switches);
  if (staff instanceof Response) return staff;
  return Response.json({ results: await checkProviders() });
}
