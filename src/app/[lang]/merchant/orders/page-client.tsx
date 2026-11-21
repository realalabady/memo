"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { X } from "@phosphor-icons/react";
import { PayoutState } from "@/components/dashboard/payout-state";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { fluid } from "@/components/ui/motion";
import { Button, Field, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useMerchantScope } from "@/lib/auth/merchant-scope";
import { useMerchantOrders, useSettings } from "@/lib/data/hooks";
import { setFulfillment } from "@/lib/data/mutations";
import type { FulfillmentStatus, MerchantOrder } from "@/lib/types";
import { cn, shortId, pct } from "@/lib/utils";

const filters = ["all", "pending", "shipped", "delivered"] as const;

/** Side panel with everything needed to pack and ship one order. */
function OrderDrawer({ order, readOnly, onClose }: { order: MerchantOrder; readOnly: boolean; onClose: () => void }) {
  const t = useT().merchant;
  const { col } = useT().dash;
  const account = useT().account;
  const checkoutT = useT().checkout;
  const status = useT().status;
  const { money, date, lang } = useFormat();
  const { data: settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const offscreen = lang === "ar" ? "-105%" : "105%";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function advance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: FulfillmentStatus = order.fulfillmentStatus === "pending" ? "shipped" : "delivered";
    const tracking = String(new FormData(e.currentTarget).get("trackingNumber") ?? "").trim() || undefined;
    setBusy(true);
    try {
      await setFulfillment(order.id, next, tracking);
      toast(fmt(t.markedAs, { status: status[next] ?? next }));
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  const lines: [string, string][] = [
    [col.sale, money(order.subtotal, { decimals: true })],
    [`${col.commission} (${pct(order.commissionRate)})`, `−${money(order.commission, { decimals: true })}`],
    [col.bnplFee, `−${money(order.providerFee, { decimals: true })}`],
  ];

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={t.orderDetails}
        initial={{ x: offscreen }}
        animate={{ x: 0 }}
        exit={{ x: offscreen }}
        transition={{ duration: 0.6, ease: fluid }}
        className="fixed inset-y-2 end-2 z-50 flex w-[calc(100%-1rem)] max-w-md flex-col overflow-y-auto rounded-[2rem] bg-paper p-6 shadow-[var(--shadow-float)] ring-1 ring-ink/[0.06]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{date(order.createdAt, true)}</p>
            <h2 className="font-display mt-1 text-3xl">
              {t.orderDetails} <span className="font-mono text-lg" dir="ltr">#{shortId(order.orderId)}</span>
            </h2>
          </div>
          <button onClick={onClose} aria-label={t.close} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink/5">
            <X weight="light" className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill status={order.fulfillmentStatus} />
          {order.provider !== "demo" && <ProviderChip provider={order.provider} />}
          <PayoutState row={order} settings={settings} />
        </div>

        <ul className="mt-6 space-y-3">
          {order.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-sand">
                {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm">{localized(i, "title", lang)}</span>
              <span className="text-xs text-muted">× {i.quantity}</span>
              <span className="text-sm tabular-nums">{money(i.total ?? i.unitPrice * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-3xl bg-cream/60 p-4 text-sm">
          <p className="text-[11px] font-medium text-muted">{account.shipTo}</p>
          <p className="mt-1">{order.customer.firstName} {order.customer.lastName}</p>
          <p className="text-muted">{order.customer.line1}, {order.customer.city}{order.customer.zip ? ` ${order.customer.zip}` : ""}</p>
          {order.customer.nationalAddress && (
            <p className="text-muted">
              {checkoutT.nationalAddress}: <span dir="ltr">{order.customer.nationalAddress}</span>
            </p>
          )}
          <p className="text-muted" dir="ltr">{order.customer.phone}</p>
        </div>

        <dl className="mt-6 space-y-2 text-sm">
          {lines.map(([label, value]) => (
            <div key={label} className="flex justify-between text-muted">
              <dt>{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-ink/[0.06] pt-2">
            <dt className="font-medium">{col.youReceive}</dt>
            <dd className="font-display text-2xl tabular-nums">{money(order.payoutAmount, { decimals: true })}</dd>
          </div>
        </dl>

        {order.trackingNumber && order.fulfillmentStatus !== "pending" && (
          <p className="mt-4 text-sm text-muted">
            {t.trackingNumber}: <span className="font-mono text-ink" dir="ltr">{order.trackingNumber}</span>
          </p>
        )}

        {!readOnly && order.fulfillmentStatus !== "delivered" && (
          <form onSubmit={advance} className="mt-auto space-y-3 pt-6">
            {order.fulfillmentStatus === "pending" && <Field label={t.trackingPrompt} name="trackingNumber" dir="ltr" maxLength={60} />}
            <Button type="submit" disabled={busy} className="w-full justify-between">
              {order.fulfillmentStatus === "pending" ? t.markShipped : t.markDelivered}
            </Button>
          </form>
        )}
      </motion.aside>
    </>
  );
}

export default function MerchantOrders() {
  const t = useT().merchant;
  const { col } = useT().dash;
  const status = useT().status;
  const { money, date, lang } = useFormat();
  const { merchantId, readOnly } = useMerchantScope();
  const { data: orders, loading } = useMerchantOrders(merchantId);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const paid = orders.filter((o) => o.paymentStatus === "captured");
  const rows = filter === "all" ? paid : paid.filter((o) => o.fulfillmentStatus === filter);
  const open = orders.find((o) => o.id === openId) ?? null;

  return (
    <>
      <PageHeader eyebrow={fmt(t.paidOrders, { n: paid.length })} title={<>{t.ordersTitle} <span className="italic">{t.ordersEm}</span></>} />
      <div className="mb-4 flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-ink/[0.04] p-1">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-4 py-1.5 text-[13px] capitalize transition", filter === f ? "bg-paper shadow-sm" : "text-muted")}>
            {status[f] ?? f}
          </button>
        ))}
      </div>
      <Panel>
        <Table head={[col.order, col.date, col.shipTo, col.items, col.paidVia, col.yourShare, col.status, ""]} empty={!loading && !rows.length}>
          {rows.map((o) => (
            <tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer">
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="text-muted">{date(o.createdAt, true)}</td>
              <td>
                <p>{o.customer.firstName} {o.customer.lastName}</p>
                <p className="text-[11px] text-muted">{o.customer.city}</p>
              </td>
              <td>{o.items.map((i) => `${localized(i, "title", lang)} ×${i.quantity}`).join(lang === "ar" ? "، " : ", ")}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{money(o.payoutAmount, { decimals: true })}</td>
              <td>
                <StatusPill status={o.fulfillmentStatus} />
                {o.trackingNumber && <p className="mt-1 font-mono text-[10px] text-muted" dir="ltr">{o.trackingNumber}</p>}
              </td>
              <td className="text-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenId(o.id);
                  }}
                  className={cn("rounded-full px-3 py-1.5 text-xs", !readOnly && o.fulfillmentStatus === "pending" ? "bg-ink text-paper" : "ring-1 ring-ink/10 hover:bg-cream")}
                >
                  {readOnly || o.fulfillmentStatus === "delivered" ? t.view : o.fulfillmentStatus === "pending" ? t.markShipped : t.markDelivered}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      <AnimatePresence>{open && <OrderDrawer key={open.id} order={open} readOnly={readOnly} onClose={() => setOpenId(null)} />}</AnimatePresence>
    </>
  );
}
