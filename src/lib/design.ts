import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

/* What the Design tool asks the model for, per kind, and how the finished page is read back. */

export type DesignKind = "slides" | "design" | "codebase" | "system";

const BASE = `You are the designer in Wanlly, a free AI workspace for students and independent creators around the world.
Reply with exactly one complete, self-contained HTML document inside a single \`\`\`html code fence, and nothing else: no explanation before or after.

Rules for the document:
- Put CSS in a <style> tag. You may also load Tailwind with <script src="https://cdn.tailwindcss.com"></script> and fonts from Google Fonts. Load nothing else.
- No other external files and no network requests. For pictures, use inline SVG, CSS shapes, flat colour blocks or emoji. Never link to outside images.
- Use real, specific content that fits the brief. Never use lorem ipsum.
- Clean, modern and calm. Strong hierarchy, generous spacing, readable contrast (WCAG AA), and no dark patterns.
- It must look right on its own in a browser, at the sizes described below.`;

const KIND: Record<DesignKind, string> = {
  slides: `Make a slide deck.
- Each slide is a <section class="slide"> exactly 1280px wide and 720px tall, with overflow hidden and its own background.
- 6 to 10 slides unless the brief says otherwise. One idea per slide, big type, short lines, a clear title slide and a closing slide.
- Do not add navigation, page numbers or scripts for moving between slides; Wanlly's viewer does that.`,
  design: `Design the screens for an app or website as a real, responsive page.
- If the brief is a mobile app, design for a 390px-wide phone first and make it still look intentional on a wide screen.
- If it is a website, design for 1280px wide and make it work down to 390px.
- Include the realistic states that matter (empty, filled, selected) when they help explain the design.`,
  system: `Create a design system reference page.
- Define the colours as CSS custom properties on :root and show each swatch with its name, hex value and what it's for.
- Show the type scale, spacing and radius tokens, and the core components in their states: buttons, inputs, select, checkbox, card, navigation, badge, alert, table.
- Label every section so it reads like documentation.`,
  codebase: `Design for an existing codebase, so the markup can be pasted straight into a project.
- Use Tailwind utility classes on semantic HTML, structured as clear components with an HTML comment naming each one.
- Keep it framework-friendly: no inline event handlers, consistent class patterns, and accessible labels.
- If the brief names a framework, stack or existing styles, follow them.`,
};

export function systemPrompt(kind: DesignKind) {
  return `${BASE}\n\n${KIND[kind]}`;
}

/** The request for one version: the brief, the current design if there is one, and the change. */
export function userPrompt(opts: { name: string; brief: string; request: string; current: string | null }) {
  const parts = [`Project: ${opts.name}`];
  if (opts.brief.trim()) parts.push(`Brief:\n${opts.brief.trim()}`);
  if (opts.current) {
    parts.push(`Current design:\n\`\`\`html\n${opts.current}\n\`\`\``);
    parts.push(`Change to make:\n${opts.request}\n\nReturn the full updated document, not just the changed part.`);
  } else {
    parts.push(`Request:\n${opts.request}`);
  }
  return parts.join("\n\n");
}

/** Pulls the HTML document out of a reply, whether it is fenced or not. Null if there isn't one. */
export function extractHtml(reply: string): string | null {
  const fenced = reply.match(/```(?:html)?\s*\n([\s\S]*?)(?:\n```|$)/i);
  let html = (fenced ? fenced[1] : reply).trim();
  const start = html.search(/<!doctype html|<html[\s>]/i);
  if (start > 0) html = html.slice(start);
  const end = html.toLowerCase().lastIndexOf("</html>");
  if (end >= 0) html = html.slice(0, end + 7);
  return /<(html|body|section|div)[\s>]/i.test(html) && html.length > 200 ? html.slice(0, 400_000) : null;
}


/** A Design project, only if it belongs to this person and isn't deleted. */
export async function designFile(userId: string, id: number) {
  const p = schema.projects;
  const [row] = await db()
    .select({ id: p.id, name: p.name, kind: p.kind, about: p.about, instructions: p.instructions, modelId: p.modelId, updatedAt: p.updatedAt })
    .from(p)
    .where(and(eq(p.id, id), eq(p.ownerId, userId), eq(p.tool, "design"), isNull(p.deletedAt)))
    .limit(1);
  return row ? { ...row, kind: (row.kind ?? "design") as DesignKind } : null;
}

export function idParam(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
