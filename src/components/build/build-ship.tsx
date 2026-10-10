"use client";

import type { BuildFile } from "@/lib/build-preview";

/** Sending the app out into the world: GitHub and publishing (filled in by later phases). */
export function BuildShip(_: { id: number; files: BuildFile[]; kind: "html" | "react" | "none" }) {
  return null;
}
