"use client";

import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, RevenueChart, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { ButtonLink, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useMerchantScope } from "@/lib/auth/merchant-scope";
import { useMerchantOrders, useMerchantProducts, usePayouts, useSettings } from "@/lib/data/hooks";
import { payoutEligibility } from "@/lib/money";
import type { OrderLine } from "@/lib/types";
import { shortId } from "@/lib/utils";

export default function MerchantOverview() {
  const t = useT().merchant;
  const col = useT().dash.col;
  const { money, date, lang } = useFormat();
  const { merchantId, merchant, readOnly } = useMerchantScope();
  const { data: orders } = useMerchantOrders(merchantId);
  const { data: payouts } = usePayouts(merchantId);
  const { data: products } = useMerchantProducts(merchantId);
  const { data: settings } = useSettings();
  const paid = orders.filter((o) => o.paymentStatus === "captured");
  const owed = paid.filter((o) => o.payoutStatus !== "paid");
  const ready = owed.filter((o) => payoutEligibility(o, settings).eligible);

  // Best sellers by units, from paid orders
  const top = Object.values(
    paid
      .flatMap((o) => o.items)
      .reduce<Record<string, { line: OrderLine; units: number; revenue: number }>>((acc, i) => {
        acc[i.productId] ??= { line: i, units: 0, revenue: 0 };
        acc[i.productId].units += i.quantity;
        acc[i.productId].revenue += i.total ?? i.unitPrice * i.quantity;
        return acc;
      }, {}),
  )
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);
  const low = products.filter((p) => p.status === "active" && p.stock <= 3).sort((a, b) => a.stock - b.stock);

  return (
    <>
      <PageHeader
        eyebrow={merchant?.storeName ?? t.yourStore}
        title={
          <>
            {t.greeting}
            <span className="italic text-ember">.</span>
          </>
        }
        actions={!readOnly && <ButtonLink href="/merchant/products/new">{t.addProduct}</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label={t.grossSales} value={sum(paid, (o) => o.subtotal)} hint={fmt(t.paidOrders, { n: paid.length })} />
        <StatCard index={1} label={t.earnings} value={sum(paid, (o) => o.payoutAmount)} hint={t.earningsHint} />
        <StatCard
          index={2}
          tone="ember"
          label={t.pendingPayout}
          value={sum(owed, (o) => o.payoutAmount)}
          hint={fmt(t.readyToPay, { amount: money(sum(ready, (o) => o.payoutAmount)) })}
        />
        <StatCard index={3} tone="ink" label={t.paidOut} value={sum(payouts, (p) => p.amount)} hint={fmt(t.transfers, { n: payouts.length })} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart orders={orders} />
        </div>
        <Panel title={t.toShip}>
          <ul className="space-y-1 px-3 pb-4">
            {paid.filter((o) => o.fulfillmentStatus === "pending").slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-cream/60">
                <div className="relative size-10 overflow-hidden rounded-xl bg-sand">
                  {o.items[0]?.image && <Image src={o.items[0].image} alt="" fill sizes="40px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{o.items[0] ? localized(o.items[0], "title", lang) : ""}</p>
                  <p className="text-[11px] text-muted">{o.customer.firstName} · {o.customer.city}</p>
                </div>
                <Link href="/merchant/orders" className="text-[11px] text-muted hover:text-ink">{t.ship}</Link>
              </li>
            ))}
            {paid.every((o) => o.fulfillmentStatus !== "pending") && <p className="py-8 text-center text-sm text-muted">{t.caughtUp}</p>}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title={t.topProducts}>
          <ul className="space-y-1 px-3 pb-4">
            {top.map(({ line, units, revenue }) => (
              <li key={line.productId} className="flex items-center gap-3 rounded-2xl p-2">
                <div className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {line.image && <Image src={line.image} alt="" fill sizes="40px" className="object-cover" />}
                </div>
                <p className="min-w-0 flex-1 truncate text-[13px]">{localized(line, "title", lang)}</p>
                <span className="text-[11px] text-muted">{fmt(t.sold, { n: units })}</span>
                <span className="text-[13px] tabular-nums">{money(revenue)}</span>
              </li>
            ))}
            {!top.length && <p className="py-8 text-center text-sm text-muted">{t.noSales}</p>}
          </ul>
        </Panel>
        <Panel title={t.lowStock}>
          <ul className="space-y-1 px-3 pb-4">
            {low.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link href={`/merchant/products/${p.id}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-cream/60">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-sand">
                    {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-[13px]">{localized(p, "title", lang)}</p>
                  <span className="rounded-full bg-ember-soft px-2.5 py-0.5 text-[11px] font-medium text-[#8f321a]">{fmt(t.left, { n: p.stock })}</span>
                </Link>
              </li>
            ))}
            {!low.length && <p className="py-8 text-center text-sm text-muted">{t.allStocked}</p>}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4" title={t.recentOrders} actions={<Link href="/merchant/orders" className="text-xs text-muted hover:text-ink">{t.allOrders}</Link>}>
        <Table head={[col.order, col.date, col.customer, col.paidVia, col.sale, col.yourShare, col.payout]} empty={!orders.length}>
          {orders.slice(0, 8).map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="text-muted">{date(o.createdAt)}</td>
              <td>{o.customer.firstName} {o.customer.lastName}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{money(o.subtotal)}</td>
              <td className="tabular-nums font-medium">{money(o.payoutAmount, { decimals: true })}</td>
              <td><StatusPill status={o.paymentStatus === "captured" ? o.payoutStatus : o.paymentStatus} /></td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
