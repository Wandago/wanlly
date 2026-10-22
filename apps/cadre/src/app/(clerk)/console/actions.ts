"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/db/client";
import { agentSettings, orgs } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { AGENTS, AGENT_IDS } from "@/lib/catalog";
import { canChangeSettings } from "@/lib/roles";
import { getShop } from "@/lib/shop";

const agentToggle = z.object({
  agent: z.enum(AGENT_IDS as [string, ...string[]]),
  enabled: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function setAgentEnabled(formData: FormData): Promise<void> {
  const shop = await getShop();
  if (!canChangeSettings(shop.role)) throw new Error("Only owners and managers can change your cadre.");
  const input = agentToggle.parse({ agent: formData.get("agent"), enabled: formData.get("enabled") });
  if (!AGENTS.find((a) => a.id === input.agent)?.available) throw new Error("That agent isn't available yet.");

  await withOrg(shop.orgId, async (db) => {
    const changed = await db
      .update(agentSettings)
      .set({ enabled: input.enabled, updatedAt: new Date() })
      .where(
        and(
          eq(agentSettings.orgId, shop.orgId),
          eq(agentSettings.agent, input.agent as (typeof AGENT_IDS)[number]),
          eq(agentSettings.enabled, !input.enabled),
        ),
      )
      .returning({ agent: agentSettings.agent });
    if (changed.length) {
      await recordAudit(db, shop.orgId, {
        actorType: "member",
        actorId: shop.clerkUserId,
        action: input.enabled ? "agent.enabled" : "agent.disabled",
        target: input.agent,
        data: { agent: input.agent },
      });
    }
  });
  revalidatePath("/console");
}

const shopDetails = z.object({
  name: z.string().trim().min(1, "Give your shop a name.").max(120, "Keep the name under 120 characters."),
  town: z.string().trim().max(80, "Keep the town under 80 characters."),
});

export type ShopFormState = { ok: boolean; message: string };

export async function updateShop(_prev: ShopFormState, formData: FormData): Promise<ShopFormState> {
  const shop = await getShop();
  if (!canChangeSettings(shop.role)) return { ok: false, message: "Only owners and managers can change shop details." };
  const parsed = shopDetails.safeParse({ name: formData.get("name") ?? "", town: formData.get("town") ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  await withOrg(shop.orgId, async (db) => {
    await db
      .update(orgs)
      .set({ name: parsed.data.name, town: parsed.data.town || null, updatedAt: new Date() })
      .where(eq(orgs.id, shop.orgId));
    await recordAudit(db, shop.orgId, {
      actorType: "member",
      actorId: shop.clerkUserId,
      action: "shop.updated",
      data: { name: parsed.data.name, town: parsed.data.town },
    });
  });
  revalidatePath("/console", "layout");
  return { ok: true, message: "Saved." };
}
