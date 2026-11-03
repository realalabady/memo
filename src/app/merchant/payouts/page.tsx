"use client";

import { PageHeader } from "@/components/dashboard/shell";
import { Panel, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { ProviderChip } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantOrders, usePayouts } from "@/lib/data/hooks";
import { formatDate, formatSAR, shortId } from "@/lib/utils";

export default function MerchantPayouts() {
  const { user } = useAuth();
  const { data: orders } = useMerchantOrders(user?.uid ?? null);
  const { data: payouts } = usePayouts(user?.uid ?? null);
  const owed = orders.filter((o) => o.paymentStatus === "captured" && o.payoutStatus === "unpaid");

  return (
    <>
      <PageHeader eyebrow="Payouts" title={<>Money <span className="italic">in</span></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} tone="ember" label="Pending payout" value={sum(owed, (o) => o.payoutAmount)} hint="Transferred by memo to your IBAN" />
        <StatCard index={1} label="Commission paid" value={sum(orders.filter((o) => o.paymentStatus === "captured"), (o) => o.commission)} />
        <StatCard index={2} tone="ink" label="Total paid out" value={sum(payouts, (p) => p.amount)} />
      </div>

      <Panel className="mt-4" title="Awaiting transfer">
        <Table head={["Order", "Date", "Paid via", "Sale", "Commission", "BNPL fee", "You receive"]} empty={!owed.length}>
          {owed.map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="text-muted">{formatDate(o.createdAt)}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{formatSAR(o.subtotal)}</td>
              <td className="tabular-nums text-muted">−{formatSAR(o.commission, { decimals: true })} ({Math.round(o.commissionRate * 100)}%)</td>
              <td className="tabular-nums text-muted">−{formatSAR(o.providerFee, { decimals: true })}</td>
              <td className="tabular-nums font-medium">{formatSAR(o.payoutAmount, { decimals: true })}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel className="mt-4" title="Transfer history">
        <Table head={["Date", "Reference", "Orders", "Note", "Amount"]} empty={!payouts.length}>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="text-muted">{formatDate(p.createdAt)}</td>
              <td className="font-mono text-xs">{p.reference}</td>
              <td>{p.merchantOrderIds.length}</td>
              <td className="text-muted">{p.note}</td>
              <td className="tabular-nums font-medium">{formatSAR(p.amount, { decimals: true })}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
