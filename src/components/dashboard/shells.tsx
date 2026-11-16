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
import { useT } from "@/i18n/client";
import { DashboardShell } from "./shell";

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useT().dash;
  const nav = [
    { href: "/admin", label: t.navAdmin.overview, icon: ChartPieSlice },
    { href: "/admin/transactions", label: t.navAdmin.transactions, icon: ListBullets },
    { href: "/admin/payouts", label: t.navAdmin.payouts, icon: Bank },
    { href: "/admin/merchants", label: t.navAdmin.merchants, icon: Storefront },
    { href: "/admin/categories", label: t.navAdmin.categories, icon: SquaresFour },
    { href: "/admin/settings", label: t.navAdmin.settings, icon: Gear },
  ];
  return (
    <DashboardShell role="admin" title={t.adminTitle} nav={nav}>
      {children}
    </DashboardShell>
  );
}

export function MerchantShell({ children }: { children: ReactNode }) {
  const t = useT().dash;
  const nav = [
    { href: "/merchant", label: t.navMerchant.overview, icon: ChartLineUp },
    { href: "/merchant/products", label: t.navMerchant.products, icon: Package },
    { href: "/merchant/orders", label: t.navMerchant.orders, icon: Receipt },
    { href: "/merchant/payouts", label: t.navMerchant.payouts, icon: Bank },
    { href: "/merchant/settings", label: t.navMerchant.store, icon: Gear },
  ];
  return (
    <DashboardShell role="merchant" title={t.storeTitle} nav={nav}>
      {children}
    </DashboardShell>
  );
}
