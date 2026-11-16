"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bezel, Button, Eyebrow, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCustomerOrders } from "@/lib/data/hooks";
import { shortId } from "@/lib/utils";

export default function AccountPage() {
  const t = useT().account;
  const invoiceT = useT().invoice;
  const common = useT().common;
  const { money, date, lang } = useFormat();
  const { user, profile, merchant, loading, signOut } = useAuth();
  const router = useRouter();
  const { data: orders, loading: ordersLoading } = useCustomerOrders(user?.uid ?? null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/account");
  }, [loading, user, router]);

  if (!user) return <div className="min-h-[100dvh]" />;

  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-4xl">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h1 className="font-display mt-6 text-6xl leading-[0.92]">
              {t.hi} <span className="italic">{profile?.displayName?.split(" ")[0] || t.there}.</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile?.role === "admin" && <Link href="/admin" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">{t.admin}</Link>}
            {profile?.role === "merchant" && <Link href="/merchant" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">{t.merchantHub}</Link>}
            {!merchant && profile?.role === "customer" && <Link href="/sell" className="rounded-full px-4 py-2 text-sm ring-1 ring-ink/10">{t.openStore}</Link>}
            {merchant?.status === "pending" && <span className="rounded-full bg-sand px-4 py-2 text-sm">{t.underReview}</span>}
            <Button size="sm" variant="ghost" onClick={() => signOut().then(() => router.push("/"))}>{common.signOut}</Button>
          </div>
        </Reveal>

        <h2 className="font-display mb-6 mt-16 text-3xl italic">{t.yourOrders}</h2>
        {ordersLoading ? (
          <div className="h-40 animate-pulse rounded-[2rem] bg-cream" />
        ) : orders.length === 0 ? (
          <p className="rounded-[2rem] bg-cream/60 p-10 text-center text-muted">{t.noOrders}</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <Bezel key={o.id} innerClassName="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted">#{shortId(o.id)}</span>
                    <span className="text-sm text-muted">{date(o.createdAt)}</span>
                    {o.provider !== "demo" && <ProviderChip provider={o.provider} />}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={o.paymentStatus} />
                    {(o.paymentStatus === "captured" || o.paymentStatus === "refunded") && (
                      <Link href={`/account/orders/${o.id}/invoice`} className="text-xs text-ink/60 underline underline-offset-4 hover:text-ink">
                        {invoiceT.link}
                      </Link>
                    )}
                    <span className="font-medium tabular-nums">{money(o.total)}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto">
                  {o.items.map((i) => (
                    <div key={i.productId} className="flex shrink-0 items-center gap-2 rounded-2xl bg-cream/60 p-1.5 pe-3">
                      <div className="relative size-10 overflow-hidden rounded-xl bg-sand">
                        {i.image && <Image src={i.image} alt="" fill sizes="40px" className="object-cover" />}
                      </div>
                      <span className="text-xs">{localized(i, "title", lang)} × {i.quantity}</span>
                    </div>
                  ))}
                </div>
              </Bezel>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
