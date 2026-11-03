"use client";

import { useMemo, useState } from "react";
import { DownloadSimple, MagnifyingGlass } from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, sum, Table } from "@/components/dashboard/widgets";
import { Button, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { useMerchantOrders } from "@/lib/data/hooks";
import type { MerchantOrder } from "@/lib/types";
import { cn, formatDate, formatSAR, shortId } from "@/lib/utils";

function toCsv(rows: MerchantOrder[]) {
  const head = ["date", "order", "customer", "email", "phone", "items", "merchant", "provider", "payment", "sale", "commission", "bnpl_fee", "merchant_payout", "payout_status"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      r.orderId,
      `${r.customer.firstName} ${r.customer.lastName}`,
      r.customer.email,
      r.customer.phone,
      r.items.map((i) => `${i.title} x${i.quantity}`).join("; "),
      r.merchantName,
      r.provider,
      r.paymentStatus,
      r.subtotal,
      r.commission,
      r.providerFee,
      r.payoutAmount,
      r.payoutStatus,
    ]
      .map(esc)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly T[] }) {
  return (
    <div className="flex gap-1 rounded-full bg-ink/[0.04] p-1">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={cn("rounded-full px-3 py-1.5 text-[12px] capitalize transition", value === o ? "bg-paper shadow-sm" : "text-muted")}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function AdminTransactions() {
  const { data, loading } = useMerchantOrders();
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState<"all" | "tabby" | "tamara">("all");
  const [payout, setPayout] = useState<"all" | "unpaid" | "paid">("all");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter(
      (r) =>
        (provider === "all" || r.provider === provider) &&
        (payout === "all" || (r.paymentStatus === "captured" && r.payoutStatus === payout)) &&
        (!s ||
          [r.orderId, r.merchantName, r.customer.firstName, r.customer.lastName, r.customer.email, ...r.items.map((i) => i.title)]
            .join(" ")
            .toLowerCase()
            .includes(s)),
    );
  }, [data, q, provider, payout]);
  const paid = rows.filter((r) => r.paymentStatus === "captured");

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `memo-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader
        eyebrow={`${rows.length} rows`}
        title={<>Who bought <span className="italic">what</span></>}
        actions={<Button variant="paper" icon={<DownloadSimple weight="light" className="size-4" />} onClick={exportCsv}>Export CSV</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-64 flex-1 items-center gap-2 rounded-full bg-paper px-4 ring-1 ring-ink/[0.08] md:max-w-sm">
          <MagnifyingGlass weight="light" className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, customer, store, product" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <Segmented value={provider} onChange={setProvider} options={["all", "tabby", "tamara"] as const} />
        <Segmented value={payout} onChange={setPayout} options={["all", "unpaid", "paid"] as const} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        {[
          ["Sales", sum(paid, (r) => r.subtotal)],
          ["Commission", sum(paid, (r) => r.commission)],
          ["BNPL fees", sum(paid, (r) => r.providerFee)],
          ["To merchants", sum(paid, (r) => r.payoutAmount)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-paper px-4 py-3 ring-1 ring-ink/[0.06]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{l}</p>
            <p className="mt-1 tabular-nums">{formatSAR(v as number, { decimals: true })}</p>
          </div>
        ))}
      </div>
      <Panel>
        <Table head={["Date", "Order", "Customer", "Items", "Store", "Via", "Payment", "Sale", "Commission", "Fee", "Merchant gets", "Payout"]} empty={!loading && !rows.length}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-muted">{formatDate(r.createdAt, true)}</td>
              <td className="font-mono text-xs">#{shortId(r.orderId)}</td>
              <td>
                <p className="whitespace-nowrap">{r.customer.firstName} {r.customer.lastName}</p>
                <p className="text-[11px] text-muted">{r.customer.email}</p>
              </td>
              <td className="max-w-52">{r.items.map((i) => `${i.title} ×${i.quantity}`).join(", ")}</td>
              <td className="whitespace-nowrap">{r.merchantName}</td>
              <td>{r.provider !== "demo" && <ProviderChip provider={r.provider} />}</td>
              <td><StatusPill status={r.paymentStatus} /></td>
              <td className="tabular-nums">{formatSAR(r.subtotal)}</td>
              <td className="tabular-nums text-muted">{formatSAR(r.commission, { decimals: true })}</td>
              <td className="tabular-nums text-muted">{formatSAR(r.providerFee, { decimals: true })}</td>
              <td className="tabular-nums font-medium">{formatSAR(r.payoutAmount, { decimals: true })}</td>
              <td>{r.paymentStatus === "captured" ? <StatusPill status={r.payoutStatus} /> : "—"}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
