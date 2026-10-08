import "server-only";

/** Trims a form field and caps its length. Returns "" when missing. */
export function field(data: Record<string, unknown>, key: string, max: number): string {
  const v = data[key];
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;

/** Reads a JSON body of at most 8 KB. Bigger or broken bodies return null. */
export async function smallJson(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > 8192) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
