import "server-only";
import { rawSql } from "@/db";
import { streamReply } from "./ai";
import { emailHtml, emailText, type EmailContent } from "./email-layout";
import { mailReady, sendMail } from "./mail";
import { SITE_URL } from "./site";

/*
 * Auto-replies to questions (contact page and support tickets), while Admin → Messages →
 * Auto-reply is on: an instant "we've got it" email with, where it helps, a short answer written
 * from FACTS below by Wanlly's own AI, clearly labelled, with a person still following up. Topics a
 * person must handle (advertising deals, press, privacy requests) get the acknowledgement and the
 * right link only. The admin "Draft reply" button uses the same facts.
 * Keep FACTS true: the assistant may only say what's here.
 */

export const FACTS = `
What Wanlly is: a website (wanlly.africa) to chat, write code and design with top AI models, free. No card and no subscription. Built in Nairobi, Kenya; founded by Louis Wandago.
How it's free: people earn credits by watching short sponsor ads, answering surveys (CPX Research) or trying sponsor offers. The first ad each day gives a bonus (8 credits); each later ad gives 4. Replies cost credits; bigger models cost more, and the cost shows before you send.
Limits: everyone has the same session (6 hours) and weekly spending limits, so no one account can run up costs.
Beta: apply at wanlly.africa/beta. Once approved, create the account with the same email used to apply. Some days approval is instant.
Invites: when a friend joins with your invite link, you both get 20 credits (up to 25 friends).
Tools: Chat (questions, plans, writing), Code (builds websites and apps, preview, publish at wanlly.africa/s/your-name, save to GitHub), Design (posters, slides, designs to download). Images and Coworkers are coming soon.
Models: Claude (Anthropic), Gemini (Google), Grok (xAI), DeepSeek and open models. Each model shows its data policy before you pick it; Claude is best for private work.
Privacy: Wanlly never uses your work to train AI. Delete your account any time in Profile → Delete account. Advertisers never see your prompts or work.
Advertising: brands build a campaign at wanlly.africa/advertise/create (visual ads or suggested ads), offer a price and set a budget (minimum US$20). The team reviews it and confirms the price within a working day; it goes live once paid.
Help: signed-in people can raise a support ticket under Help and support in the app. Replies come by email.
Not covered here (a person must answer): refunds or payments to people, account bans or credit disputes, partnerships, press, legal questions, anything about a specific account's data.
`.trim();

/** Topics a person answers: no AI answer, just the acknowledgement and a pointer. */
const HUMAN_ONLY: Record<string, { text: string; link?: { label: string; url: string } }> = {
  "Advertise on Wanlly": { text: "You can build your campaign online now: make the ad, offer a price and set a budget. We review it within a working day.", link: { label: "Create a campaign", url: `${SITE_URL}/advertise/create` } },
  Partnerships: { text: "Louis or someone from the team will reply personally." },
  Press: { text: "Louis will reply personally, usually within a working day." },
  Privacy: { text: "To delete your account and data yourself, go to Profile → Delete account in the app. For anything else, we'll reply personally.", link: { label: "Read our privacy policy", url: `${SITE_URL}/privacy` } },
};

/** A short answer from FACTS, or null when there isn't a safe one. */
export async function draftAnswer(question: string, name = ""): Promise<string | null> {
  const system = `You are Wanlly's support assistant, writing a short email answer to someone's question.
Use ONLY these facts; never invent features, prices, dates or promises:
${FACTS}
Rules: plain text, no markdown headings or lists symbols other than "- ". 120 words at most. Friendly and direct, British English. ${name ? `Their first name is ${name}.` : ""}
Don't greet or sign off (the email does that). If the facts don't answer the question, or it's about payments, refunds, bans, a specific account, legal matters, or anything sensitive, reply with exactly: NONE`;
  try {
    let text = "";
    for await (const ev of streamReply({ modelId: "gemini-flash", tool: "chat", system, turns: [{ role: "user", text: question.slice(0, 3000) }], signal: AbortSignal.timeout(20_000) })) {
      if (ev.type === "text") text += ev.text;
    }
    const answer = text.replace(/^#+\s*/gm, "").trim();
    return !answer || /^NONE\b/.test(answer) || answer.length > 1500 ? null : answer;
  } catch (e) {
    console.error("auto-reply draft failed", e instanceof Error ? e.message : e);
    return null;
  }
}

async function enabled() {
  return rawSql()`select coalesce((select value = 'true'::jsonb from app_flags where key = 'autoReply'), false) as on`
    .then((r) => (r as { on: boolean }[])[0]?.on === true)
    .catch(() => false);
}

/**
 * Sends the auto-reply, when switched on. Returns the answer it included (or "" for an
 * acknowledgement only), or null when nothing was sent.
 */
export async function autoReply(q: { to: string; name: string; topic: string; question: string; ticket?: number }): Promise<string | null> {
  if (!mailReady() || !(await enabled())) return null;
  const first = q.name.trim().split(/\s+/)[0] || "";
  const human = HUMAN_ONLY[q.topic];
  const answer = human ? null : await draftAnswer(q.question, first);
  const paragraphs = [
    q.ticket ? `Thanks for raising ticket #${q.ticket}. We've got it.` : "Thanks for writing to Wanlly. We've got your message.",
    ...(human ? [human.text] : []),
    ...(answer ? ["**A quick answer from Wanlly's assistant** (a person will still read your message and follow up if this doesn't fully answer it):", ...answer.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)] : []),
    answer || human ? "" : "A person will reply, usually within one working day.",
  ].filter(Boolean);
  const content: EmailContent = {
    preview: answer ? "Here's a quick answer while a person reads your message." : "We've got your message and will reply soon.",
    heading: first ? `Thanks, ${first}` : "Thanks for your message",
    paragraphs,
    button: human?.link,
    after: [`Your message: "${q.question.slice(0, 300)}${q.question.length > 300 ? "…" : ""}"`, "Need to add something? Just reply to this email."],
    signoff: "Wanlly",
  };
  const subject = q.ticket ? `Re: your Wanlly ticket #${q.ticket}` : "Re: your message to Wanlly";
  try {
    await sendMail({ to: q.to, subject, text: emailText(content), html: emailHtml(content, SITE_URL) });
    return answer ?? "";
  } catch (e) {
    console.error("auto-reply email failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Columns the auto-reply and admin replies add to contact messages (created on first use). */
let cols = false;
export async function ensureMessageColumns() {
  if (cols) return;
  await rawSql()`alter table contact_messages add column if not exists auto_reply text, add column if not exists reply text, add column if not exists replied_at timestamptz`;
  cols = true;
}
