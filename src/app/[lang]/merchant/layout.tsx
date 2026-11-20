import type { Metadata } from "next";
import { Suspense } from "react";
import { RoleGate } from "@/components/dashboard/role-gate";
import { MerchantShell } from "@/components/dashboard/shells";

// Dashboards wait for the Firebase session on the client, so navigations here block by design.
export const instant = false;

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MerchantLayout({ children }: LayoutProps<"/[lang]/merchant">) {
  return (
    <>
      {/* Server-side session check streams in beside the shell and redirects if not allowed,
          so the dashboard's static shell (and its pages) stay prerenderable. */}
      <Suspense fallback={null}>
        <RoleGate role="merchant" />
      </Suspense>
      <MerchantShell>{children}</MerchantShell>
    </>
  );
}