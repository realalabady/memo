"use client";

import { pct } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, sum, Table } from "@/components/dashboard/widgets";
import { StatusPill } from "@/components/ui/primitives";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useMerchantOrders, useMerchants, useSettings } from "@/lib/data/hooks";
import { setMerchantStatus } from "@/lib/data/mutations";
import type { Merchant, MerchantStatus } from "@/lib/types";

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

  const setStatus = (m: Merchant, s: MerchantStatus) => act(() => setMerchantStatus(m.id, s), fmt(t.merchantStatus, { status: status[s] ?? s }));

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
                    <Link href={`/admin/merchants/${m.id}`} className="font-medium underline-offset-4 hover:underline">{m.storeName}</Link>
                    <Link href={`/admin/merchants/${m.id}`} className="block text-[11px] text-muted hover:text-ink">{t.details} →</Link>
                  </td>
                  <td className="text-muted">{m.city}</td>
                  <td className="text-muted">{date(m.createdAt)}</td>
                  <td><StatusPill status={m.status} /></td>
                  <td className="tabular-nums">{money(sum(mine, (r) => r.subtotal))}</td>
                  <td>
                    <span className="tabular-nums text-muted">
                      {m.commissionRate === undefined || m.commissionRate === null
                        ? fmt(t.defaultCommission, { n: Math.round(settings.commissionRate * 100) })
                        : pct(m.commissionRate)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-end">
                    {m.status !== "approved" && (
                      <button onClick={() => setStatus(m, "approved")} className="rounded-full bg-ink px-3 py-1.5 text-xs text-paper">{t.approve}</button>
                    )}
                    {m.status === "pending" && (
                      <Link href={`/admin/merchants/${m.id}`} className="ms-2 rounded-full px-3 py-1.5 text-xs text-muted ring-1 ring-ink/10 hover:text-ember">{t.reject}</Link>
                    )}
                    {m.status === "approved" && (
                      <button onClick={() => setStatus(m, "suspended")} className="rounded-full px-3 py-1.5 text-xs text-muted ring-1 ring-ink/10 hover:text-ember">{t.suspend}</button>
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
