// Safe handling of player-supplied text. Everything is also rendered with textContent on the
// client, so this is about keeping names readable and civil, not about escaping HTML.

// Starter list only. Before a public launch, replace it with a reviewed list that covers
// English, Kiswahili and Sheng insults and slurs (see docs/10-quality-checklist.md).
const BLOCKED = ["fuck", "shit", "cunt", "bitch", "asshole", "bastard", "malaya", "kumanyoko"];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };

function squash(text) {
  return text.toLowerCase().replace(/[013457@$]/g, (c) => LEET[c]).replace(/[^\p{L}]/gu, "");
}

export function isBlocked(text) {
  const s = squash(text);
  return BLOCKED.some((w) => s.includes(w));
}

/** Clean text: strip control and invisible formatting characters, collapse whitespace. */
export function clean(text, max) {
  return Array.from(String(text ?? "").normalize("NFC").replace(/[\p{C}]/gu, " ").replace(/\s+/g, " ").trim()).slice(0, max).join("");
}

export function cleanName(raw) {
  const name = clean(raw, 20);
  if (Array.from(name).length < 2) return { error: "Names need at least 2 characters." };
  if (!/[\p{L}\p{N}]/u.test(name)) return { error: "Names need at least one letter or number." };
  if (isBlocked(name)) return { error: "Please choose a different name." };
  return { name };
}

export function cleanChat(raw, max) {
  const text = clean(raw, max);
  if (!text) return { error: "Empty message." };
  return { text, flagged: isBlocked(text) };
}
