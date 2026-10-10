import { emailHtml, emailText, type EmailContent } from "./email-layout";

/** The beta invite: the same words whether Wanlly emails it or the admin sends it by hand. */
export function inviteMessage(a: { name: string; email: string }, site: string) {
  // "You're in, info" reads oddly: a "name" that's just the email's first part isn't used.
  const name = a.name.trim().toLowerCase() === a.email.split("@")[0].toLowerCase() ? "" : a.name.trim().split(/\s+/)[0];
  const content: EmailContent = {
    preview: "Your place in the Wanlly beta is ready. Sign up with this email to start building.",
    heading: name ? `You're in, ${name}` : "You're in",
    paragraphs: [
      "Thanks for applying to the Wanlly beta. Your place is ready.",
      `Create your account with **${a.email}**, the address you applied with, so Wanlly knows it's you.`,
    ],
    button: { label: "Create your account", url: `${site}/sign-up` },
    after: [
      "Watch short sponsor ads to earn credits, then chat, code and design with the world's top AI models. No card, no subscription.",
      "Something not working? Just reply to this email.",
    ],
    signoff: "Louis\nWanlly",
  };
  return { subject: "You're in: your Wanlly beta invite", text: emailText(content), html: emailHtml(content, site) };
}
