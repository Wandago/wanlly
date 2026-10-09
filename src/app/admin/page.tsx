import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/admin-console";

export const metadata: Metadata = {
  title: "Admin · Wanlly",
  robots: { index: false },
};

// Signed-in staff only: every request behind this page checks the person's role on the server.
export default function AdminPage() {
  return <AdminConsole />;
}
