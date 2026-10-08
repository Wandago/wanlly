import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin · Wanlly",
  robots: { index: false },
};

// Design preview with sample data. Sign-in and role checks arrive with Clerk (Step 2).
export default function AdminPage() {
  return <AdminDashboard />;
}
