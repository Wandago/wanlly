import type { Db } from "@/db/client";
import { auditLog } from "@/db/schema";

export type AuditEntry = {
  actorType: "member" | "agent" | "system";
  actorId: string;
  action: string;
  target?: string;
  data?: Record<string, unknown>;
};

/** Appends to the shop's audit log. The database sets the sequence number and hash chain. */
export async function recordAudit(db: Db, orgId: string, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    orgId,
    actorType: entry.actorType,
    actorId: entry.actorId,
    action: entry.action,
    target: entry.target ?? "",
    data: entry.data ?? {},
  });
}
