import "server-only";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { NO_NETWORKS, cleanNetwork, cleanNetworks, type NetworksConfig } from "./ad-network";

/**
 * Every network, stored under "adNetworks". Before there was a list, one network was stored
 * under "adNetwork"; that one is read as a list of one until the list is first saved.
 */
export async function loadNetworks(): Promise<NetworksConfig> {
  try {
    const rows = await db().select({ key: schema.appFlags.key, value: schema.appFlags.value }).from(schema.appFlags).where(inArray(schema.appFlags.key, ["adNetworks", "adNetwork"]));
    const list = rows.find((r) => r.key === "adNetworks");
    if (list) return cleanNetworks(list.value);
    const one = rows.find((r) => r.key === "adNetwork");
    if (!one) return NO_NETWORKS;
    const n = cleanNetwork(one.value);
    return cleanNetworks({ host: n.host, list: n.name || Object.keys(n.units).length ? [{ ...n, name: n.name || "network" }] : [] });
  } catch {
    return NO_NETWORKS;
  }
}
