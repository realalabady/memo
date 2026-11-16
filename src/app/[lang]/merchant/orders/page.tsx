"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { ProviderChip, StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantOrders } from "@/lib/data/hooks";
import { setFulfillment } from "@/lib/data/mutations";
import type { FulfillmentStatus } from "@/lib/types";
import { cn, shortId } from "@/lib/utils";

const filters = ["all", "pending", "shipped", "delivered"] as const;

export default function MerchantOrders() {
  const t = useT().merchant;
  const { col } = useT().dash;
  const status = useT().status;
  const { money, date, lang } = useFormat();
  const { user } = useAuth();
  const { data: orders, loading } = useMerchantOrders(user?.uid ?? null);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const paid = orders.filter((o) => o.paymentStatus === "captured");
  const rows = filter === "all" ? paid : paid.filter((o) => o.fulfillmentStatus === filter);

  async function update(id: string, next: FulfillmentStatus) {
    // Tracking is optional; cancelling the prompt still marks the order.
    const trackingNumber = next === "shipped" ? (window.prompt(t.trackingPrompt) ?? "").trim() || undefined : undefined;
    try {
      await setFulfillment(id, next, trackingNumber);
      toast(fmt(t.markedAs, { status: status[next] ?? next }));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={fmt(t.paidOrders, { n: paid.length })} title={<>{t.ordersTitle} <span className="italic">{t.ordersEm}</span></>} />
      <div className="mb-4 flex w-max gap-1 rounded-full bg-ink/[0.04] p-1">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-4 py-1.5 text-[13px] capitalize transition", filter === f ? "bg-paper shadow-sm" : "text-muted")}>
            {status[f] ?? f}
          </button>
        ))}
      </div>
      <Panel>
        <Table head={[col.order, col.date, col.shipTo, col.items, col.paidVia, col.yourShare, col.status, ""]} empty={!loading && !rows.length}>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="text-muted">{date(o.createdAt, true)}</td>
              <td>
                <p>{o.customer.firstName} {o.customer.lastName}</p>
                <p className="text-[11px] text-muted">{o.customer.line1}, {o.customer.city} · <span dir="ltr">{o.customer.phone}</span></p>
              </td>
              <td>{o.items.map((i) => `${localized(i, "title", lang)} ×${i.quantity}`).join(lang === "ar" ? "، " : ", ")}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{money(o.payoutAmount, { decimals: true })}</td>
              <td>
                <StatusPill status={o.fulfillmentStatus} />
                {o.trackingNumber && <p className="mt-1 font-mono text-[10px] text-muted">{o.trackingNumber}</p>}
              </td>
              <td className="text-end">
                {o.fulfillmentStatus === "pending" && (
                  <button onClick={() => update(o.id, "shipped")} className="rounded-full bg-ink px-3 py-1.5 text-xs text-paper">{t.markShipped}</button>
                )}
                {o.fulfillmentStatus === "shipped" && (
                  <button onClick={() => update(o.id, "delivered")} className="rounded-full px-3 py-1.5 text-xs ring-1 ring-ink/10 hover:bg-cream">{t.markDelivered}</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
