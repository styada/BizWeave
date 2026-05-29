import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar userName={session.name ?? session.email} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
