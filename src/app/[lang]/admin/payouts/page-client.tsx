"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CaretDown, Copy } from "@phosphor-icons/react";
import { PayoutState } from "@/components/dashboard/payout-state";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { expo } from "@/components/ui/motion";
import { Button, ProviderChip } from "@/components/ui/primitives";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { useMerchantBank, useMerchantOrders, useOpenAdjustments, usePayouts, useSettings } from "@/lib/data/hooks";
import { setPayoutHold } from "@/lib/data/mutations";
import { payoutEligibility } from "@/lib/money";
import type { MerchantOrder, PlatformSettings } from "@/lib/types";
import { cn, shortId } from "@/lib/utils";

function MerchantBalance({ merchantId, name, rows, settings }: { merchantId: string; name: string; rows: MerchantOrder[]; settings: PlatformSettings }) {
  const t = useT().admin;
  const { col } = useT().dash;
  const stateT = useT().payoutState;
  const { money, date } = useFormat();
  const [open, setOpen] = useState(false);
  const payable = useMemo(() => rows.filter((r) => payoutEligibility(r, settings).eligible), [rows, settings]);
  const [deselected, setDeselected] = useState<Set<string>>(() => new Set());
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: bank } = useMerchantBank(open ? merchantId : null);
  const { data: adjustments } = useOpenAdjustments(open ? merchantId : null);
  const { demo } = useAuth();
  const authedFetch = useAuthedFetch();
  const chosen = payable.filter((r) => !deselected.has(r.id));
  const deductions = sum(adjustments, (a) => a.amount);
  const amount = Math.round((sum(chosen, (r) => r.payoutAmount) + deductions) * 100) / 100;
  const total = sum(rows, (r) => r.payoutAmount);

  function toggle(id: string) {
    setDeselected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function record() {
    if (demo) return toast.error(t.demoPayouts);
    if (!chosen.length || reference.trim().length < 2) return toast.error(t.selectOrders);
    setBusy(true);
    const res = await authedFetch("/api/admin/payouts", {
      method: "POST",
      body: JSON.stringify({ merchantId, merchantOrderIds: chosen.map((r) => r.id), reference }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return toast.error(body.error ?? t.payoutFailed);
    toast(fmt(t.recorded, { amount: money(body.amount, { decimals: true }), name }));
    setReference("");
  }

  async function hold(row: MerchantOrder) {
    const next = row.payoutStatus !== "on_hold";
    try {
      await setPayoutHold(row.id, next);
      toast(next ? t.holdDone : t.releaseDone);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
      <div className="rounded-[calc(1.75rem-0.375rem)] bg-paper shadow-[var(--shadow-inset)]">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 p-5 text-start">
          <span className="flex size-11 items-center justify-center rounded-full bg-ink font-display text-xl italic text-paper">{name.slice(0, 1)}</span>
          <span className="flex-1">
            <span className="block font-medium">{name}</span>
            <span className="text-[12px] text-muted">
              {fmt(t.paidAwaiting, { n: rows.length })} · {stateT.eligible}: {payable.length}
            </span>
          </span>
          <span className="font-display text-3xl tabular-nums">{money(total, { decimals: true })}</span>
          <CaretDown weight="light" className={cn("size-5 transition-transform duration-500 ease-[var(--ease-fluid)]", open && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: expo }} className="overflow-hidden">
              <div className="grid gap-4 border-t border-ink/[0.05] p-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Table head={["", col.order, col.date, col.via, col.sale, col.transfer, stateT.column, ""]}>
                    {rows.map((r) => {
                      const ok = payoutEligibility(r, settings).eligible;
                      return (
                        <tr key={r.id} onClick={() => ok && toggle(r.id)} className={ok ? "cursor-pointer" : "opacity-70"}>
                          <td><input type="checkbox" readOnly disabled={!ok} checked={ok && !deselected.has(r.id)} className="accent-[var(--color-ink)]" /></td>
                          <td className="font-mono text-xs">#{shortId(r.orderId)}</td>
                          <td className="text-muted">{date(r.createdAt)}</td>
                          <td>{r.provider !== "demo" && <ProviderChip provider={r.provider} />}</td>
                          <td className="tabular-nums">{money(r.subtotal)}</td>
                          <td className="tabular-nums font-medium">{money(r.payoutAmount, { decimals: true })}</td>
                          <td><PayoutState row={r} settings={settings} /></td>
                          <td className="text-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                hold(r);
                              }}
                              className="rounded-full px-3 py-1 text-xs text-muted ring-1 ring-ink/10 hover:text-ink"
                            >
                              {r.payoutStatus === "on_hold" ? t.release : t.hold}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </Table>
                </div>
                <div className="space-y-3 rounded-3xl bg-ink p-5 text-paper">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-paper/50">{t.transferTo}</p>
                  {bank.iban ? (
                    <div className="space-y-1 text-sm">
                      <p>{bank.accountHolder}</p>
                      <p className="text-paper/60">{bank.bankName}</p>
                      <button dir="ltr" onClick={() => navigator.clipboard.writeText(bank.iban.replace(/\s/g, "")).then(() => toast(t.ibanCopied))} className="flex items-center gap-2 font-mono text-[13px] text-ember">
                        {bank.iban} <Copy className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-paper/60">{t.noBank}</p>
                  )}
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-paper/50">{fmt(t.amountFor, { n: chosen.length })}</p>
                    <p className="font-display mt-1 text-4xl tabular-nums">{money(Math.max(0, amount), { decimals: true })}</p>
                    {deductions !== 0 && (
                      <p className="mt-1 text-[12px] text-ember">
                        {t.deductions}: {money(deductions, { decimals: true })}
                      </p>
                    )}
                  </div>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={t.reference}
                    className="h-11 w-full rounded-full bg-white/10 px-4 text-sm outline-none placeholder:text-paper/40 focus:bg-white/15"
                  />
                  <Button variant="ember" disabled={busy || !chosen.length || amount < 0} onClick={record} className="w-full justify-between">
                    {t.markTransferred}
                  </Button>
                  <p className="text-[11px] text-paper/50">{t.transferNote}</p>
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
  const t = useT().admin;
  const { col } = useT().dash;
  const { money, date } = useFormat();
  const { data: rows } = useMerchantOrders();
  const { data: payouts } = usePayouts();
  const { data: settings } = useSettings();
  // Everything paid by the shopper and not yet transferred (including rows still waiting or on hold).
  const owed = useMemo(() => rows.filter((r) => r.paymentStatus === "captured" && r.payoutStatus !== "paid"), [rows]);
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
      <PageHeader eyebrow={t.settlements} title={<>{t.oweTitle} <span className="italic text-ember">{t.oweEm}</span></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} tone="ember" label={t.outstanding} value={sum(owed, (r) => r.payoutAmount)} hint={fmt(t.merchantsN, { n: groups.length })} />
        <StatCard index={1} label={t.ordersToSettle} value={owed.length} format={(n) => String(Math.round(n))} />
        <StatCard index={2} tone="ink" label={t.transferredAll} value={sum(payouts, (p) => p.amount)} />
      </div>

      <div className="mt-6 space-y-3">
        {groups.map(([id, g]) => (
          <MerchantBalance key={id} merchantId={id} name={g.name} rows={g.rows} settings={settings} />
        ))}
        {!groups.length && <p className="rounded-[1.75rem] bg-paper p-10 text-center text-muted ring-1 ring-ink/[0.06]">{t.allSettled}</p>}
      </div>

      <Panel className="mt-6" title={t.payoutHistory}>
        <Table head={[col.date, col.merchant, col.reference, col.orders, col.amount]} empty={!payouts.length}>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="text-muted">{date(p.createdAt, true)}</td>
              <td>{p.merchantName}</td>
              <td className="font-mono text-xs">{p.reference}</td>
              <td>{p.merchantOrderIds.length}</td>
              <td className="tabular-nums font-medium">{money(p.amount, { decimals: true })}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
