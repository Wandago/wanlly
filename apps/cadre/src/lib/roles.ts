export type MemberRole = "owner" | "manager" | "viewer";

/** Clerk's built-in organisation roles, mapped to Cadre's. Unknown roles get the least access. */
export function roleFromClerk(clerkRole: string | null | undefined): MemberRole {
  if (clerkRole === "org:admin") return "owner";
  if (clerkRole === "org:member") return "manager";
  return "viewer";
}

export function canChangeSettings(role: MemberRole): boolean {
  return role === "owner" || role === "manager";
}
