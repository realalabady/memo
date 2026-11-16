"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, RevenueChart, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { expo } from "@/components/ui/motion";
import { ButtonLink, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useMerchantOrders, usePayouts } from "@/lib/data/hooks";
import { shortId } from "@/lib/utils";

export default function AdminOverview() {
  const t = useT().admin;
  const { col, orders: ordersN } = useT().dash;
  const { money, date, lang } = useFormat();
  const { data: rows } = useMerchantOrders();
  const { data: payouts } = usePayouts();
  const paid = rows.filter((r) => r.paymentStatus === "captured");
  const owed = paid.filter((r) => r.payoutStatus !== "paid");
  const gmv = sum(paid, (r) => r.subtotal);
  const tabby = sum(paid.filter((r) => r.provider === "tabby"), (r) => r.subtotal);
  const tamara = sum(paid.filter((r) => r.provider === "tamara"), (r) => r.subtotal);

  // Balance owed per merchant
  const balances = Object.values(
    owed.reduce<Record<string, { id: string; name: string; amount: number; count: number }>>((acc, r) => {
      acc[r.merchantId] ??= { id: r.merchantId, name: r.merchantName, amount: 0, count: 0 };
      acc[r.merchantId].amount += r.payoutAmount;
      acc[r.merchantId].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.amount - a.amount);
  const maxBalance = Math.max(1, ...balances.map((b) => b.amount));

  return (
    <>
      <PageHeader
        eyebrow={t.marketplace}
        title={
          <>
            {t.ledgerTitle} <span className="italic text-ember">{t.ledgerEm}</span>
          </>
        }
        actions={<ButtonLink href="/admin/payouts" variant="ember">{t.settle}</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label={t.collected} value={gmv} hint={fmt(t.paidMerchantOrders, { n: paid.length })} />
        <StatCard index={1} label={t.commission} value={sum(paid, (r) => r.commission)} hint={t.platformRevenue} />
        <StatCard index={2} tone="ember" label={t.owed} value={sum(owed, (r) => r.payoutAmount)} hint={fmt(t.merchantsWaiting, { n: balances.length })} />
        <StatCard index={3} tone="ink" label={t.transferred} value={sum(payouts, (p) => p.amount)} hint={fmt(t.payoutsRecorded, { n: payouts.length })} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart orders={rows} title={t.collectedChart} />
        </div>
        <Panel title={t.byProvider}>
          <div className="space-y-5 px-5 pb-6 pt-3">
            {[
              { p: "tabby" as const, v: tabby },
              { p: "tamara" as const, v: tamara },
            ].map(({ p, v }, i) => (
              <div key={p}>
                <div className="flex items-center justify-between text-sm">
                  <ProviderChip provider={p} />
                  <span className="tabular-nums">{money(Math.round(v))}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.05]">
                  <motion.div
                    className={p === "tabby" ? "h-full rounded-full bg-tabby" : "h-full rounded-full bg-tamara"}
                    initial={{ width: 0 }}
                    animate={{ width: `${gmv ? (v / gmv) * 100 : 0}%` }}
                    transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: expo }}
                  />
                </div>
              </div>
            ))}
            <p className="rounded-2xl bg-cream/70 p-3 text-[12px] text-ink/70">
              {fmt(t.feesOnFile, { amount: money(sum(paid, (r) => r.providerFee), { decimals: true }) })}
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title={t.whoYouOwe} actions={<Link href="/admin/payouts" className="text-xs text-muted hover:text-ink">{t.payOut}</Link>}>
          <ul className="space-y-4 px-5 pb-6 pt-2">
            {balances.map((b, i) => (
              <li key={b.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{b.name}</span>
                  <span className="font-medium tabular-nums">{money(b.amount, { decimals: true })}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                  <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${(b.amount / maxBalance) * 100}%` }} transition={{ duration: 1.1, delay: 0.2 + i * 0.08, ease: expo }} />
                </div>
                <p className="mt-1 text-[11px] text-muted">{fmt(ordersN, { n: b.count })}</p>
              </li>
            ))}
            {!balances.length && <p className="py-8 text-center text-sm text-muted">{t.settled}</p>}
          </ul>
        </Panel>
        <Panel className="xl:col-span-2" title={t.latest} actions={<Link href="/admin/transactions" className="text-xs text-muted hover:text-ink">{t.allTransactions}</Link>}>
          <Table head={[col.order, col.customer, col.bought, col.store, col.via, col.paid, col.merchantGets]} empty={!rows.length}>
            {rows.slice(0, 8).map((r) => (
              <tr key={r.id}>
                <td>
                  <p className="font-mono text-xs">#{shortId(r.orderId)}</p>
                  <p className="text-[11px] text-muted">{date(r.createdAt)}</p>
                </td>
                <td>{r.customer.firstName} {r.customer.lastName}</td>
                <td className="max-w-48 truncate">{r.items.map((i) => `${localized(i, "title", lang)} ×${i.quantity}`).join(lang === "ar" ? "، " : ", ")}</td>
                <td>{r.merchantName}</td>
                <td>{r.provider !== "demo" && <ProviderChip provider={r.provider} />}</td>
                <td className="tabular-nums">{r.paymentStatus === "captured" ? money(r.subtotal) : <StatusPill status={r.paymentStatus} />}</td>
                <td className="tabular-nums font-medium">{money(r.payoutAmount, { decimals: true })}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
