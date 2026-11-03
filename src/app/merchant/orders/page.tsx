"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { ProviderChip, StatusPill } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantOrders } from "@/lib/data/hooks";
import { setFulfillment } from "@/lib/data/mutations";
import type { FulfillmentStatus } from "@/lib/types";
import { cn, formatDate, formatSAR, shortId } from "@/lib/utils";

const filters = ["all", "pending", "shipped", "delivered"] as const;

export default function MerchantOrders() {
  const { user } = useAuth();
  const { data: orders, loading } = useMerchantOrders(user?.uid ?? null);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const paid = orders.filter((o) => o.paymentStatus === "captured");
  const rows = filter === "all" ? paid : paid.filter((o) => o.fulfillmentStatus === filter);

  async function update(id: string, status: FulfillmentStatus) {
    try {
      await setFulfillment(id, status);
      toast(`Marked as ${status}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={`${paid.length} paid orders`} title={<>Orders to <span className="italic">fulfil</span></>} />
      <div className="mb-4 flex gap-1 rounded-full bg-ink/[0.04] p-1 w-max">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-4 py-1.5 text-[13px] capitalize transition", filter === f ? "bg-paper shadow-sm" : "text-muted")}>
            {f}
          </button>
        ))}
      </div>
      <Panel>
        <Table head={["Order", "Date", "Ship to", "Items", "Paid via", "Your share", "Status", ""]} empty={!loading && !rows.length}>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="text-muted">{formatDate(o.createdAt, true)}</td>
              <td>
                <p>{o.customer.firstName} {o.customer.lastName}</p>
                <p className="text-[11px] text-muted">{o.customer.line1}, {o.customer.city} · {o.customer.phone}</p>
              </td>
              <td>{o.items.map((i) => `${i.title} ×${i.quantity}`).join(", ")}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{formatSAR(o.payoutAmount, { decimals: true })}</td>
              <td><StatusPill status={o.fulfillmentStatus} /></td>
              <td className="text-right">
                {o.fulfillmentStatus === "pending" && (
                  <button onClick={() => update(o.id, "shipped")} className="rounded-full bg-ink px-3 py-1.5 text-xs text-paper">Mark shipped</button>
                )}
                {o.fulfillmentStatus === "shipped" && (
                  <button onClick={() => update(o.id, "delivered")} className="rounded-full px-3 py-1.5 text-xs ring-1 ring-ink/10 hover:bg-cream">Mark delivered</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
