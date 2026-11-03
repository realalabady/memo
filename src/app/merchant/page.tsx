"use client";

import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, RevenueChart, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { ButtonLink, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantOrders, usePayouts } from "@/lib/data/hooks";
import { formatDate, formatSAR, shortId } from "@/lib/utils";

export default function MerchantOverview() {
  const { user, merchant } = useAuth();
  const { data: orders } = useMerchantOrders(user?.uid ?? null);
  const { data: payouts } = usePayouts(user?.uid ?? null);
  const paid = orders.filter((o) => o.paymentStatus === "captured");
  const owed = paid.filter((o) => o.payoutStatus === "unpaid");

  return (
    <>
      <PageHeader
        eyebrow={merchant?.storeName ?? "Your store"}
        title={
          <>
            Good to see you<span className="italic text-ember">.</span>
          </>
        }
        actions={<ButtonLink href="/merchant/products/new">Add product</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Gross sales" value={sum(paid, (o) => o.subtotal)} hint={`${paid.length} paid orders`} />
        <StatCard index={1} label="Your earnings" value={sum(paid, (o) => o.payoutAmount)} hint="After commission & BNPL fee" />
        <StatCard index={2} tone="ember" label="Pending payout" value={sum(owed, (o) => o.payoutAmount)} hint={`${owed.length} orders awaiting transfer`} />
        <StatCard index={3} tone="ink" label="Paid out" value={sum(payouts, (p) => p.amount)} hint={`${payouts.length} transfers`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart orders={orders} />
        </div>
        <Panel title="To ship">
          <ul className="space-y-1 px-3 pb-4">
            {paid.filter((o) => o.fulfillmentStatus === "pending").slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-cream/60">
                <div className="relative size-10 overflow-hidden rounded-xl bg-sand">
                  {o.items[0]?.image && <Image src={o.items[0].image} alt="" fill sizes="40px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{o.items[0]?.title}</p>
                  <p className="text-[11px] text-muted">{o.customer.firstName} · {o.customer.city}</p>
                </div>
                <Link href="/merchant/orders" className="text-[11px] text-muted hover:text-ink">Ship →</Link>
              </li>
            ))}
            {paid.every((o) => o.fulfillmentStatus !== "pending") && <p className="py-8 text-center text-sm text-muted">All caught up.</p>}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4" title="Recent orders" actions={<Link href="/merchant/orders" className="text-xs text-muted hover:text-ink">All orders →</Link>}>
        <Table head={["Order", "Date", "Customer", "Paid via", "Sale", "Your share", "Payout"]} empty={!orders.length}>
          {orders.slice(0, 8).map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="text-muted">{formatDate(o.createdAt)}</td>
              <td>{o.customer.firstName} {o.customer.lastName}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{formatSAR(o.subtotal)}</td>
              <td className="tabular-nums font-medium">{formatSAR(o.payoutAmount, { decimals: true })}</td>
              <td><StatusPill status={o.paymentStatus === "captured" ? o.payoutStatus : o.paymentStatus} /></td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
