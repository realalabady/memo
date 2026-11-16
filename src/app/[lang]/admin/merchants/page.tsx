"use client";

import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, sum, Table } from "@/components/dashboard/widgets";
import { StatusPill } from "@/components/ui/primitives";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useMerchantOrders, useMerchants, useSettings } from "@/lib/data/hooks";
import { setMerchantCommission, setMerchantStatus } from "@/lib/data/mutations";
import type { MerchantStatus } from "@/lib/types";

export default function AdminMerchants() {
  const t = useT().admin;
  const { col } = useT().dash;
  const status = useT().status;
  const { money, date } = useFormat();
  const { data: merchants, loading } = useMerchants();
  const { data: rows } = useMerchantOrders();
  const { data: settings } = useSettings();
  const pending = merchants.filter((m) => m.status === "pending");

  async function act(fn: () => Promise<void>, msg: string) {
    try {
      await fn();
      toast(msg);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const setStatus = (id: string, s: MerchantStatus) =>
    act(() => setMerchantStatus(id, s), fmt(t.merchantStatus, { status: status[s] ?? s }));

  return (
    <>
      <PageHeader eyebrow={fmt(t.storesCount, { n: merchants.length, p: pending.length })} title={<>{t.storesTitle} <span className="italic">{t.storesEm}</span></>} />
      <Panel>
        <Table head={[col.store, col.city, col.joined, col.status, col.sales, col.commission, ""]} empty={!loading && !merchants.length}>
          {merchants.map((m) => {
            const mine = rows.filter((r) => r.merchantId === m.id && r.paymentStatus === "captured");
            return (
              <tr key={m.id}>
                <td>
                  <p className="font-medium">{m.storeName}</p>
                  <p className="text-[11px] text-muted" dir="ltr">{m.email ?? m.slug}</p>
                </td>
                <td className="text-muted">{m.city}</td>
                <td className="text-muted">{date(m.createdAt)}</td>
                <td><StatusPill status={m.status} /></td>
                <td className="tabular-nums">{money(sum(mine, (r) => r.subtotal))}</td>
                <td>
                  <select
                    defaultValue={m.commissionRate ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      act(() => setMerchantCommission(m.id, v === "" ? null : Number(v)), t.commissionUpdated);
                    }}
                    className="rounded-full bg-cream px-3 py-1.5 text-xs outline-none"
                  >
                    <option value="">{fmt(t.defaultCommission, { n: Math.round(settings.commissionRate * 100) })}</option>
                    {[0, 0.05, 0.08, 0.1, 0.12, 0.15, 0.2].map((r) => (
                      <option key={r} value={r}>{Math.round(r * 100)}%</option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap text-end">
                  {m.status !== "approved" && (
                    <button onClick={() => setStatus(m.id, "approved")} className="rounded-full bg-ink px-3 py-1.5 text-xs text-paper">{t.approve}</button>
                  )}
                  {m.status === "approved" && (
                    <button onClick={() => setStatus(m.id, "suspended")} className="rounded-full px-3 py-1.5 text-xs text-muted ring-1 ring-ink/10 hover:text-ember">{t.suspend}</button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </>
  );
}
