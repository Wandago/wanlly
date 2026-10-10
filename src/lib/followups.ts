/*
 * Follow-up ideas, the way Claude suggests them: the model ends each Chat or Code reply with one
 * hidden line, <!--next: idea | idea | idea-->, which the app shows as buttons above the composer
 * instead of as text. It costs nothing extra: the ideas come in the same reply.
 */

export const FOLLOWUP_INSTRUCTION =
  " After your answer, on the very last line, write exactly <!--next: first idea | second idea | third idea--> with three short " +
  "follow-up messages this person would plausibly send next, specific to this conversation, written in their voice " +
  '(for example "Add a contact form" or "Explain step 2 more simply"), each under 50 characters. Write nothing after it.';

/** The reply to show (without the hidden line, or a half-written one while it streams) and its ideas. */
export function replyParts(text: string): { body: string; next: string[] } {
  const m = text.match(/<!--\s*next:([\s\S]*?)-->\s*$/);
  if (m) {
    const next = m[1]
      .split("|")
      .map((s) => s.trim().replace(/^["'“]|["'”]$/g, ""))
      .filter((s) => s && s.length <= 90)
      .slice(0, 3);
    return { body: text.slice(0, m.index).trimEnd(), next };
  }
  // Still streaming: hide a hidden line that has started but not finished.
  const open = text.lastIndexOf("<!--");
  return { body: open >= 0 && !text.includes("-->", open) ? text.slice(0, open).trimEnd() : text, next: [] };
}
