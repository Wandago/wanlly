import type { Metadata } from "next";
import { ProfileView } from "@/components/pages/profile-view";

export const metadata: Metadata = { title: "Profile · Wanlly" };

export default function ProfilePage() {
  return <ProfileView />;
}
