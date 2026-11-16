"use client";

import { PayoutState } from "@/components/dashboard/payout-state";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { ProviderChip } from "@/components/ui/primitives";
import { useFormat, useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantOrders, usePayouts, useSettings } from "@/lib/data/hooks";
import { shortId } from "@/lib/utils";

export default function MerchantPayouts() {
  const t = useT().merchant;
  const { col } = useT().dash;
  const { money, date } = useFormat();
  const { user } = useAuth();
  const { data: orders } = useMerchantOrders(user?.uid ?? null);
  const { data: payouts } = usePayouts(user?.uid ?? null);
  const { data: settings } = useSettings();
  const stateT = useT().payoutState;
  const owed = orders.filter((o) => o.paymentStatus === "captured" && o.payoutStatus !== "paid");

  return (
    <>
      <PageHeader eyebrow={t.payoutsEyebrow} title={<>{t.payoutsTitle} <span className="italic">{t.payoutsEm}</span></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} tone="ember" label={t.pendingPayout} value={sum(owed, (o) => o.payoutAmount)} hint={t.payoutHint} />
        <StatCard index={1} label={t.commissionPaid} value={sum(orders.filter((o) => o.paymentStatus === "captured"), (o) => o.commission)} />
        <StatCard index={2} tone="ink" label={t.totalPaidOut} value={sum(payouts, (p) => p.amount)} />
      </div>

      <Panel className="mt-4" title={t.awaitingTransferTitle}>
        <Table head={[col.order, col.date, col.paidVia, col.sale, col.commission, col.bnplFee, col.youReceive, stateT.column]} empty={!owed.length}>
          {owed.map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="text-muted">{date(o.createdAt)}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{money(o.subtotal)}</td>
              <td className="tabular-nums text-muted">−{money(o.commission, { decimals: true })} ({Math.round(o.commissionRate * 100)}%)</td>
              <td className="tabular-nums text-muted">−{money(o.providerFee, { decimals: true })}</td>
              <td className="tabular-nums font-medium">{money(o.payoutAmount, { decimals: true })}</td>
              <td><PayoutState row={o} settings={settings} /></td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel className="mt-4" title={t.transferHistory}>
        <Table head={[col.date, col.reference, col.orders, col.note, col.amount]} empty={!payouts.length}>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="text-muted">{date(p.createdAt)}</td>
              <td className="font-mono text-xs">{p.reference}</td>
              <td>{p.merchantOrderIds.length}</td>
              <td className="text-muted">{p.note}</td>
              <td className="tabular-nums font-medium">{money(p.amount, { decimals: true })}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
