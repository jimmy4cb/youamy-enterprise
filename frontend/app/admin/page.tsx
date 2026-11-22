import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard";
import { getSessionUser } from "@backend/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin | Youamy Enterprises Limited",
  description: "Manage Youamy Enterprises listings and enquiries.",
};

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <AdminDashboard user={{ name: user.name, role: user.role }} />;
}
