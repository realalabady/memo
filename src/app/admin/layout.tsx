import { AdminShell } from "@/components/dashboard/shells";

// Dashboards wait for the Firebase session on the client, so navigations here block by design.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
