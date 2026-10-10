/** The beta invite: the same words whether Wanlly emails it or the admin sends it by hand. */
export function inviteMessage(a: { name: string; email: string }, site: string) {
  const first = a.name.trim().split(/\s+/)[0] || "there";
  return {
    subject: "You're in: your Wanlly beta invite",
    text: `Hi ${first},\n\nYou're in. Thanks for applying to the Wanlly beta.\n\nSign up here with this email address (${a.email}), so Wanlly knows it's you: ${site}/sign-up\n\nWatch short sponsor ads to earn credits, then build with the world's top AI models. Reply to this email if anything breaks.\n\nLouis, Wanlly`,
  };
}
