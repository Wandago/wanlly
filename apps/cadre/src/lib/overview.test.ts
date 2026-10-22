import { describe, expect, it } from "vitest";
import { buildAgents, buildConnections, buildSteps, describeAudit } from "./overview";
import { CURRENT_PHASE } from "./catalog";

describe("setup steps", () => {
  it("counts the shop as done and money as not connected on day one", () => {
    const steps = buildSteps({ phoneVerified: false, integrations: [] });
    expect(steps.map((s) => [s.id, s.done])).toEqual([
      ["shop", true],
      ["whatsapp", false],
      ["rules", false],
      ["money", false],
      ["bank", false],
    ]);
  });

  it("marks money done once a personal line or Till is active", () => {
    const pending = buildSteps({ phoneVerified: true, integrations: [{ kind: "daraja_till", label: "", status: "pending" }] });
    expect(pending.find((s) => s.id === "money")?.done).toBe(false);
    const live = buildSteps({ phoneVerified: true, integrations: [{ kind: "sms_forward", label: "", status: "active" }] });
    expect(live.find((s) => s.id === "money")?.done).toBe(true);
    expect(live.find((s) => s.id === "whatsapp")?.done).toBe(true);
  });
});

describe("connections", () => {
  it("shows unbuilt connections as coming soon", () => {
    const cards = buildConnections([]);
    expect(cards.every((c) => (CURRENT_PHASE < 1 ? c.state === "soon" : true))).toBe(true);
  });

  it("prefers live over failing over pending, and names the shortcode", () => {
    const cards = buildConnections([
      { kind: "daraja_till", label: "884 210", status: "pending" },
      { kind: "daraja_till", label: "884 211", status: "active" },
      { kind: "daraja_paybill", label: "522 533", status: "error" },
    ]);
    expect(cards.find((c) => c.kind === "daraja_till")).toMatchObject({ state: "live", name: "Till (Buy Goods) 884 211" });
    expect(cards.find((c) => c.kind === "daraja_paybill")).toMatchObject({ state: "error" });
  });
});

describe("agents", () => {
  it("never shows an unbuilt agent as on", () => {
    const agents = buildAgents([
      { agent: "finance", enabled: true },
      { agent: "legal", enabled: true },
    ]);
    expect(agents.find((a) => a.id === "finance")?.enabled).toBe(true);
    expect(agents.find((a) => a.id === "legal")?.enabled).toBe(false);
    expect(agents.find((a) => a.id === "chief")?.enabled).toBe(false);
  });
});

describe("activity text", () => {
  it("describes known actions in plain words", () => {
    expect(describeAudit({ action: "agent.disabled", data: { agent: "inbox" } })).toBe("turned off Inbox");
    expect(describeAudit({ action: "shop.created", data: { name: "Njeri Hardware" } })).toBe("created the shop Njeri Hardware");
    expect(describeAudit({ action: "something.new", data: null })).toBe("something.new");
  });
});
