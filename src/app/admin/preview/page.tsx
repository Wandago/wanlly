import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin preview · Wanlly",
  robots: { index: false },
};

// The ad-revenue design with sample data, kept as the target for when ad networks report real numbers.
export default function AdminPreviewPage() {
  return <AdminDashboard />;
}
