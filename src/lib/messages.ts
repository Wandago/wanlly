/*
 * What people read when something goes wrong: short, plain and calm, never technical. The team
 * sees the real cause in Admin and the logs; customers see one of these.
 */
export const SAY = {
  busy: "We're experiencing high traffic right now. Please try again in a few minutes.",
  wrong: "Something went wrong on our side. Please try again in a moment.",
  offline: "You seem to be offline. Check your connection and try again.",
  signedOut: "You've been signed out. Please sign in again to continue.",
  badRequest: "That didn't come through properly. Refresh the page and try again.",
  notFound: "We couldn't find that. It may have been deleted.",
  settingUp: "We're still setting up your account. Refresh the page in a moment.",
  refunded: "Your credits are back in your balance.",
} as const;
