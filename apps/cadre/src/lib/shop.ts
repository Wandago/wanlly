import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { ensureOrg, findOrgId, withOrg } from "@/db/client";
import { members } from "@/db/schema";
import { recordAudit } from "./audit";
import { roleFromClerk, type MemberRole } from "./roles";

export type ShopContext = { orgId: string; clerkUserId: string; role: MemberRole };

/**
 * The signed-in member and their active shop. Sends people without a session to sign in,
 * and people without a shop to onboarding. The first visit creates the shop and member rows.
 */
export const getShop = cache(async (): Promise<ShopContext> => {
  const { userId, orgId: clerkOrgId, orgRole, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  if (!clerkOrgId) redirect("/onboarding");

  let orgId = await findOrgId(clerkOrgId);
  if (!orgId) {
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: clerkOrgId });
    orgId = await ensureOrg({ clerkOrgId, name: org.name, actorId: userId });
  }

  const role = roleFromClerk(orgRole);
  await syncMember(orgId, userId, role);
  return { orgId, clerkUserId: userId, role };
});

async function syncMember(orgId: string, clerkUserId: string, role: MemberRole) {
  await withOrg(orgId, async (db) => {
    const [existing] = await db
      .select({ role: members.role })
      .from(members)
      .where(and(eq(members.orgId, orgId), eq(members.clerkUserId, clerkUserId)));
    if (!existing) {
      const inserted = await db
        .insert(members)
        .values({ orgId, clerkUserId, role })
        .onConflictDoNothing()
        .returning({ id: members.id });
      if (inserted.length) {
        await recordAudit(db, orgId, { actorType: "member", actorId: clerkUserId, action: "member.joined", data: { role } });
      }
    } else if (existing.role !== role) {
      await db
        .update(members)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(members.orgId, orgId), eq(members.clerkUserId, clerkUserId)));
    }
  });
}
