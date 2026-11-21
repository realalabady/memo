"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Bezel, Eyebrow, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { demoLedger } from "@/lib/fixtures";
import type { Address, FulfillmentStatus, OrderLine, PaymentStatus, Provider } from "@/lib/types";
import { shortId } from "@/lib/utils";

interface OrderView {
  id: string;
  paymentStatus: PaymentStatus;
  total: number;
  refundedAmount: number;
  provider: Provider | "demo";
  createdAt: number;
  customer: Address;
  parcels: {
    merchantId: string;
    merchantName: string;
    items: OrderLine[];
    subtotal: number;
    paymentStatus: PaymentStatus;
    fulfillmentStatus: FulfillmentStatus;
    trackingNumber: string | null;
  }[];
}

/** Sample-data version of /api/orders/[id] (demo mode has no server orders). */
function demoOrder(id: string): OrderView | null {
  const rows = demoLedger().orders.filter((o) => o.orderId === id && o.customerId === "c0");
  if (!rows.length) return null;
  return {
    id,
    paymentStatus: rows[0].paymentStatus,
    total: rows.reduce((s, r) => s + r.subtotal, 0),
    refundedAmount: 0,
    provider: rows[0].provider,
    createdAt: rows[0].createdAt,
    customer: rows[0].customer,
    parcels: rows.map((r) => ({ ...r, trackingNumber: r.trackingNumber ?? null })),
  };
}

function OrderDetail() {
  const t = useT().account;
  const invoiceT = useT().invoice;
  const checkoutT = useT().checkout;
  const { money, date, lang } = useFormat();
  const { id } = useParams<{ id: string }>();
  const { user, demo, loading } = useAuth();
  const authedFetch = useAuthedFetch();
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const result = !user
        ? null
        : demo
          ? demoOrder(id)
          : await authedFetch(`/api/orders/${encodeURIComponent(id)}`)
              .then((r) => (r.ok ? (r.json() as Promise<OrderView>) : null))
              .catch(() => null);
      if (!cancelled) setOrder(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, demo, loading, authedFetch]);

  if (order === undefined) return <div className="h-96 animate-pulse rounded-[2rem] bg-cream" />;
  if (!order) return <p className="rounded-[2rem] bg-cream/60 p-10 text-center text-muted">{t.orderNotFound}</p>;
  const paid = order.paymentStatus === "captured" || order.paymentStatus === "refunded";

  return (
    <>
      <Link href="/account" className="text-sm text-ink/60 underline-offset-4 hover:underline">
        {t.backToOrders}
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{date(order.createdAt, true)}</Eyebrow>
          <h1 className="font-display mt-4 text-5xl leading-[0.95]">
            {t.orderTitle} <span className="font-mono text-3xl" dir="ltr">#{shortId(order.id)}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {order.provider !== "demo" && <ProviderChip provider={order.provider} />}
          <StatusPill status={order.paymentStatus} />
          <span className="font-display text-3xl tabular-nums">{money(order.total)}</span>
        </div>
      </div>
      {order.refundedAmount > 0 && (
        <p className="mt-3 text-sm text-muted">{fmt(invoiceT.refunded, { amount: money(order.refundedAmount, { decimals: true }) })}</p>
      )}

      <div className="mt-8 space-y-4">
        {order.parcels.map((p) => (
          <Bezel key={p.merchantId} innerClassName="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">{fmt(t.soldBy, { store: p.merchantName })}</p>
              <div className="flex items-center gap-2">
                {p.paymentStatus === "refunded" ? <StatusPill status="refunded" /> : paid && <StatusPill status={p.fulfillmentStatus} />}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              {p.trackingNumber ? (
                <>
                  {t.tracking} <span className="font-mono text-ink" dir="ltr">{p.trackingNumber}</span>
                </>
              ) : (
                paid && p.paymentStatus !== "refunded" && t.noTracking
              )}
            </p>
            <ul className="mt-4 space-y-3">
              {p.items.map((i) => (
                <li key={i.productId} className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-sand">
                    {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}
                  </div>
                  <Link href={`/product/${i.productId}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                    {localized(i, "title", lang)}
                  </Link>
                  <span className="text-xs text-muted">× {i.quantity}</span>
                  <span className="text-sm tabular-nums">{money(i.total ?? i.unitPrice * i.quantity)}</span>
                </li>
              ))}
            </ul>
          </Bezel>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-6 rounded-3xl bg-cream/60 p-5 text-sm">
        <div>
          <p className="text-[11px] font-medium text-muted">{t.shipTo}</p>
          <p className="mt-1">{order.customer.firstName} {order.customer.lastName}</p>
          <p className="text-muted">{order.customer.line1}, {order.customer.city}</p>
          {order.customer.nationalAddress && (
            <p className="text-muted">
              {checkoutT.nationalAddress}: <span dir="ltr">{order.customer.nationalAddress}</span>
            </p>
          )}
          <p className="text-muted" dir="ltr">{order.customer.phone}</p>
        </div>
        {paid && (
          <Link href={`/account/orders/${order.id}/invoice`} className="rounded-full bg-ink px-4 py-2 text-paper">
            {invoiceT.link}
          </Link>
        )}
      </div>
    </>
  );
}

export default function OrderPage() {
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-[2rem] bg-cream" />}>
          <OrderDetail />
        </Suspense>
      </div>
    </section>
  );
}
