"use client";

import type { ReactNode } from "react";
import {
  Bank,
  ChartLineUp,
  ChartPieSlice,
  Gear,
  ListBullets,
  Package,
  Receipt,
  SquaresFour,
  Storefront,
} from "@phosphor-icons/react";
import { DashboardShell } from "./shell";

const adminNav = [
  { href: "/admin", label: "Overview", icon: ChartPieSlice },
  { href: "/admin/transactions", label: "Transactions", icon: ListBullets },
  { href: "/admin/payouts", label: "Payouts", icon: Bank },
  { href: "/admin/merchants", label: "Merchants", icon: Storefront },
  { href: "/admin/categories", label: "Categories", icon: SquaresFour },
  { href: "/admin/settings", label: "Settings", icon: Gear },
];

const merchantNav = [
  { href: "/merchant", label: "Overview", icon: ChartLineUp },
  { href: "/merchant/products", label: "Products", icon: Package },
  { href: "/merchant/orders", label: "Orders", icon: Receipt },
  { href: "/merchant/payouts", label: "Payouts", icon: Bank },
  { href: "/merchant/settings", label: "Store", icon: Gear },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell role="admin" title="Admin" nav={adminNav}>
      {children}
    </DashboardShell>
  );
}

export function MerchantShell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell role="merchant" title="Store" nav={merchantNav}>
      {children}
    </DashboardShell>
  );
}
