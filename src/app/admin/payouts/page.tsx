"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CaretDown, Copy } from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { expo } from "@/components/ui/motion";
import { Button, ProviderChip } from "@/components/ui/primitives";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { useMerchantBank, useMerchantOrders, usePayouts } from "@/lib/data/hooks";
import type { MerchantOrder } from "@/lib/types";
import { cn, formatDate, formatSAR, shortId } from "@/lib/utils";

function MerchantBalance({ merchantId, name, rows }: { merchantId: string; name: string; rows: MerchantOrder[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map((r) => r.id)));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: bank } = useMerchantBank(open ? merchantId : null);
  const { demo } = useAuth();
  const authedFetch = useAuthedFetch();
  const chosen = rows.filter((r) => selected.has(r.id));
  const amount = sum(chosen, (r) => r.payoutAmount);
  const total = sum(rows, (r) => r.payoutAmount);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function record() {
    if (demo) return toast.error("Demo mode — connect Firebase to record payouts");
    if (!chosen.length || reference.trim().length < 2) return toast.error("Select orders and enter the bank transfer reference");
    setBusy(true);
    const res = await authedFetch("/api/admin/payouts", {
      method: "POST",
      body: JSON.stringify({ merchantId, merchantOrderIds: chosen.map((r) => r.id), reference }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return toast.error(body.error ?? "Could not record payout");
    toast(`Recorded ${formatSAR(body.amount, { decimals: true })} to ${name}`);
    setReference("");
  }

  return (
    <div className="rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
      <div className="rounded-[calc(1.75rem-0.375rem)] bg-paper shadow-[var(--shadow-inset)]">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 p-5 text-left">
          <span className="flex size-11 items-center justify-center rounded-full bg-ink font-display text-xl italic text-paper">{name.slice(0, 1)}</span>
          <span className="flex-1">
            <span className="block font-medium">{name}</span>
            <span className="text-[12px] text-muted">{rows.length} paid orders awaiting transfer</span>
          </span>
          <span className="font-display text-3xl tabular-nums">{formatSAR(total, { decimals: true })}</span>
          <CaretDown weight="light" className={cn("size-5 transition-transform duration-500 ease-[var(--ease-fluid)]", open && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: expo }} className="overflow-hidden">
              <div className="grid gap-4 border-t border-ink/[0.05] p-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Table head={["", "Order", "Date", "Via", "Sale", "Commission", "Fee", "Transfer"]}>
                    {rows.map((r) => (
                      <tr key={r.id} onClick={() => toggle(r.id)} className="cursor-pointer">
                        <td><input type="checkbox" readOnly checked={selected.has(r.id)} className="accent-[var(--color-ink)]" /></td>
                        <td className="font-mono text-xs">#{shortId(r.orderId)}</td>
                        <td className="text-muted">{formatDate(r.createdAt)}</td>
                        <td>{r.provider !== "demo" && <ProviderChip provider={r.provider} />}</td>
                        <td className="tabular-nums">{formatSAR(r.subtotal)}</td>
                        <td className="tabular-nums text-muted">{formatSAR(r.commission, { decimals: true })}</td>
                        <td className="tabular-nums text-muted">{formatSAR(r.providerFee, { decimals: true })}</td>
                        <td className="tabular-nums font-medium">{formatSAR(r.payoutAmount, { decimals: true })}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
                <div className="space-y-3 rounded-3xl bg-ink p-5 text-paper">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-paper/50">Transfer to</p>
                  {bank.iban ? (
                    <div className="space-y-1 text-sm">
                      <p>{bank.accountHolder}</p>
                      <p className="text-paper/60">{bank.bankName}</p>
                      <button onClick={() => navigator.clipboard.writeText(bank.iban.replace(/\s/g, "")).then(() => toast("IBAN copied"))} className="flex items-center gap-2 font-mono text-[13px] text-ember">
                        {bank.iban} <Copy className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-paper/60">No bank details saved yet — ask the merchant to add their IBAN.</p>
                  )}
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-paper/50">Amount for {chosen.length} orders</p>
                    <p className="font-display mt-1 text-4xl tabular-nums">{formatSAR(amount, { decimals: true })}</p>
                  </div>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Bank transfer reference"
                    className="h-11 w-full rounded-full bg-white/10 px-4 text-sm outline-none placeholder:text-paper/40 focus:bg-white/15"
                  />
                  <Button variant="ember" disabled={busy || !chosen.length} onClick={record} className="w-full justify-between">
                    Mark as transferred
                  </Button>
                  <p className="text-[11px] text-paper/50">Send the bank transfer first, then record it here. The orders are locked to this payout.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AdminPayouts() {
  const { data: rows } = useMerchantOrders();
  const { data: payouts } = usePayouts();
  const owed = rows.filter((r) => r.paymentStatus === "captured" && r.payoutStatus === "unpaid");
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: MerchantOrder[] }>();
    for (const r of owed) {
      const g = map.get(r.merchantId) ?? { name: r.merchantName, rows: [] };
      g.rows.push(r);
      map.set(r.merchantId, g);
    }
    return [...map.entries()].sort((a, b) => sum(b[1].rows, (r) => r.payoutAmount) - sum(a[1].rows, (r) => r.payoutAmount));
  }, [owed]);

  return (
    <>
      <PageHeader eyebrow="Settlements" title={<>What you <span className="italic text-ember">owe.</span></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} tone="ember" label="Outstanding" value={sum(owed, (r) => r.payoutAmount)} hint={`${groups.length} merchants`} />
        <StatCard index={1} label="Orders to settle" value={owed.length} format={(n) => String(Math.round(n))} />
        <StatCard index={2} tone="ink" label="Transferred all-time" value={sum(payouts, (p) => p.amount)} />
      </div>

      <div className="mt-6 space-y-3">
        {groups.map(([id, g]) => (
          <MerchantBalance key={`${id}-${g.rows.length}`} merchantId={id} name={g.name} rows={g.rows} />
        ))}
        {!groups.length && <p className="rounded-[1.75rem] bg-paper p-10 text-center text-muted ring-1 ring-ink/[0.06]">All merchants are settled.</p>}
      </div>

      <Panel className="mt-6" title="Payout history">
        <Table head={["Date", "Merchant", "Reference", "Orders", "Amount"]} empty={!payouts.length}>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="text-muted">{formatDate(p.createdAt, true)}</td>
              <td>{p.merchantName}</td>
              <td className="font-mono text-xs">{p.reference}</td>
              <td>{p.merchantOrderIds.length}</td>
              <td className="tabular-nums font-medium">{formatSAR(p.amount, { decimals: true })}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
