"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCustomerOrders, useSettings } from "@/lib/data/hooks";
import { vatIncluded } from "@/lib/money";
import { shortId } from "@/lib/utils";
import { zatcaQrPayload } from "@/lib/zatca";

function Invoice() {
  const t = useT().invoice;
  const { money, lang } = useFormat();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { data: orders, loading } = useCustomerOrders(user?.uid ?? null);
  const { data: settings } = useSettings();
  const order = orders.find((o) => o.id === id);
  const [qr, setQr] = useState<string>();

  const paid = order?.paymentStatus === "captured" || order?.paymentStatus === "refunded";
  const total = order?.total ?? 0;
  const vat = order ? (order.vatAmount ?? vatIncluded(order.total, settings.vatRate)) : 0;
  const issuedAt = order?.paidAt ?? order?.createdAt ?? 0;

  useEffect(() => {
    if (!paid || !settings.vatNumber) return;
    let cancelled = false;
    QRCode.toDataURL(
      zatcaQrPayload({ sellerName: settings.sellerName, vatNumber: settings.vatNumber, timestamp: issuedAt, total, vat }),
      { margin: 0, width: 220 },
    )
      .then((url) => !cancelled && setQr(url))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [paid, settings.sellerName, settings.vatNumber, issuedAt, total, vat]);

  if (authLoading || loading) return <div className="h-96 animate-pulse rounded-[2rem] bg-cream" />;
  if (!order) return <p className="rounded-[2rem] bg-cream/60 p-10 text-center text-muted">{t.notFound}</p>;
  if (!paid) return <p className="rounded-[2rem] bg-cream/60 p-10 text-center text-muted">{t.notPaid}</p>;

  const provider = order.provider === "tabby" ? "Tabby" : order.provider === "tamara" ? "Tamara" : "memo";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/account" className="text-sm text-ink/60 underline-offset-4 hover:underline">
          {t.back}
        </Link>
        <Button size="sm" trailing={false} onClick={() => window.print()}>
          {t.print}
        </Button>
      </div>

      <article className="rounded-[2rem] bg-paper p-6 ring-1 ring-ink/[0.08] md:p-10 print:rounded-none print:p-0 print:ring-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-ink/10 pb-6">
          <div>
            <Logo />
            <h1 className="font-display mt-6 text-4xl">{t.title}</h1>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">{t.number}</dt>
              <dd className="font-mono" dir="ltr">INV-{shortId(order.id)}</dd>
              <dt className="text-muted">{t.date}</dt>
              <dd>{new Date(issuedAt).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd>
              <dt className="text-muted">{t.seller}</dt>
              <dd>{settings.sellerName}</dd>
              {settings.vatNumber && (
                <>
                  <dt className="text-muted">{t.vatNumber}</dt>
                  <dd className="font-mono" dir="ltr">{settings.vatNumber}</dd>
                </>
              )}
              <dt className="text-muted">{t.customer}</dt>
              <dd>
                {order.customer.firstName} {order.customer.lastName} · {order.customer.city}
              </dd>
            </dl>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser */}
          {qr && <img src={qr} alt="ZATCA QR" width={132} height={132} className="size-[132px]" />}
        </header>

        <table className="mt-6 w-full text-start text-sm">
          <thead>
            <tr className="text-[11px] text-muted">
              <th className="py-2 text-start font-medium">{t.item}</th>
              <th className="py-2 text-center font-medium">{t.qty}</th>
              <th className="py-2 text-end font-medium">{t.unitPrice}</th>
              <th className="py-2 text-end font-medium">{t.lineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.productId} className="border-t border-ink/[0.06]">
                <td className="py-3">{localized(i, "title", lang)}</td>
                <td className="py-3 text-center tabular-nums">{i.quantity}</td>
                <td className="py-3 text-end tabular-nums">{money(i.unitPrice, { decimals: true })}</td>
                <td className="py-3 text-end tabular-nums">{money(i.total ?? i.unitPrice * i.quantity, { decimals: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ms-auto mt-6 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-ink/10 pt-4 text-sm">
          <dt className="text-muted">{t.exVat}</dt>
          <dd className="text-end tabular-nums">{money(total - vat, { decimals: true })}</dd>
          <dt className="text-muted">{fmt(t.vat, { n: Math.round(settings.vatRate * 100) })}</dt>
          <dd className="text-end tabular-nums">{money(vat, { decimals: true })}</dd>
          <dt className="font-medium">{t.total}</dt>
          <dd className="font-display text-end text-2xl tabular-nums">{money(total, { decimals: true })}</dd>
        </dl>

        <p className="mt-8 text-xs text-muted">
          {fmt(t.paidVia, { provider })}
          {order.refundedAmount ? ` · ${fmt(t.refunded, { amount: money(order.refundedAmount, { decimals: true }) })}` : ""}
        </p>
      </article>
    </>
  );
}

export default function InvoicePage() {
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44 print:p-0">
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-[2rem] bg-cream" />}>
          <Invoice />
        </Suspense>
      </div>
    </section>
  );
}
