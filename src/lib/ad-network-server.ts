import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { NO_NETWORK, cleanNetwork, type NetworkConfig } from "./ad-network";

/** The saved network settings, or none. Stored in app_flags under "adNetwork". */
export async function loadNetwork(): Promise<NetworkConfig> {
  try {
    const [row] = await db().select({ value: schema.appFlags.value }).from(schema.appFlags).where(eq(schema.appFlags.key, "adNetwork")).limit(1);
    return row ? cleanNetwork(row.value) : NO_NETWORK;
  } catch {
    return NO_NETWORK;
  }
}
