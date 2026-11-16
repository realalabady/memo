"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Lock } from "@phosphor-icons/react";
import { QuarterRing } from "@/components/store/installments";
import { expo } from "@/components/ui/motion";
import { Bezel, Button, Eyebrow, Field, ProviderChip } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { PROVIDER_LIMITS, providerAvailable } from "@/lib/money";
import { cartTotal, useCart } from "@/lib/store/cart";
import type { Provider } from "@/lib/types";
import { cn, installment } from "@/lib/utils";

const providerName: Record<Provider, { en: string; ar: string }> = {
  tabby: { en: "Tabby", ar: "تابي" },
  tamara: { en: "Tamara", ar: "تمارا" },
};

export default function CheckoutPage() {
  const t = useT().checkout;
  const common = useT().common;
  const { money, lang } = useFormat();
  const lines = useCart((s) => s.lines);
  const { user, profile, demo, loading } = useAuth();
  const authedFetch = useAuthedFetch();
  const [provider, setProvider] = useState<Provider>("tabby");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- cart is hydrated from localStorage
  useEffect(() => setMounted(true), []);

  const total = cartTotal(lines);
  const per = installment(total);
  const needsLogin = !demo && !loading && !user;
  const name = providerName[provider][lang];
  const copy: Record<Provider, { title: string; body: string }> = {
    tabby: { title: t.tabbyTitle, body: t.tabbyBody },
    tamara: { title: t.tamaraTitle, body: t.tamaraBody },
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const customer = Object.fromEntries(
      ["firstName", "lastName", "email", "phone", "city", "line1", "zip"].map((k) => [k, String(f.get(k) ?? "")]),
    );
    setBusy(true);
    try {
      const res = await authedFetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          provider,
          lang,
          customer,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.failed);
      window.location.href = body.url;
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  if (!mounted) return <div className="min-h-[100dvh]" />;

  if (lines.length === 0) {
    return (
      <section className="flex min-h-[80dvh] flex-col items-center justify-center px-4 pt-32 text-center">
        <p className="font-display text-6xl italic">{t.empty}</p>
        <Link href="/shop" className="mt-6 text-sm underline underline-offset-4">
          {t.browse}
        </Link>
      </section>
    );
  }

  const [first = "", ...rest] = (profile?.displayName ?? "").split(" ");

  return (
    <section className="px-4 pb-12 pt-32 md:pt-40">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h1 className="font-display mt-6 text-6xl leading-[0.92] md:text-7xl">
          {t.title} <span className="italic">{t.titleEm}</span>
        </h1>

        {needsLogin && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-ember-soft px-6 py-4 text-sm">
            <span>{t.signInPrompt}</span>
            <Link href="/login?next=/checkout" className="rounded-full bg-ink px-4 py-2 text-paper">
              {common.signIn}
            </Link>
          </div>
        )}

        <form onSubmit={submit} className="mt-12 grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            <Bezel innerClassName="p-6 md:p-8">
              <p className="font-display text-3xl italic">{t.delivery}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label={t.firstName} name="firstName" required defaultValue={first} autoComplete="given-name" />
                <Field label={t.lastName} name="lastName" required defaultValue={rest.join(" ")} autoComplete="family-name" />
                <Field label={t.email} name="email" type="email" dir="ltr" required defaultValue={user?.email} autoComplete="email" />
                <Field label={t.mobile} name="phone" type="tel" dir="ltr" required placeholder="+9665XXXXXXXX" autoComplete="tel" />
                <Field label={t.city} name="city" required placeholder={t.cityPlaceholder} autoComplete="address-level2" />
                <Field label={t.zip} name="zip" dir="ltr" autoComplete="postal-code" />
                <Field className="sm:col-span-2" label={t.street} name="line1" required placeholder={t.streetPlaceholder} autoComplete="street-address" />
              </div>
            </Bezel>

            <Bezel innerClassName="p-6 md:p-8">
              <p className="font-display text-3xl italic">{t.payment}</p>
              <p className="mt-1 text-sm text-muted">{t.paymentNote}</p>
              <div className="mt-6 grid gap-3">
                {(["tabby", "tamara"] as const).map((p) => {
                  const ok = providerAvailable(p, total);
                  const selected = provider === p;
                  return (
                    <button
                      type="button"
                      key={p}
                      disabled={!ok}
                      onClick={() => setProvider(p)}
                      className={cn(
                        "relative flex items-center gap-4 rounded-3xl p-4 text-start ring-1 transition-all duration-500 ease-[var(--ease-fluid)] disabled:opacity-50",
                        selected ? "bg-cream ring-ink/30" : "ring-ink/10 hover:bg-cream/50",
                      )}
                    >
                      <span className={cn("flex size-5 items-center justify-center rounded-full ring-1 ring-ink/30", selected && "bg-ink ring-ink")}>
                        {selected && <motion.span layoutId="radio" className="size-2 rounded-full bg-paper" />}
                      </span>
                      <span className="flex-1">
                        <span className="flex items-center gap-2 text-[15px] font-medium">
                          {copy[p].title} <ProviderChip provider={p} />
                        </span>
                        <span className="text-[13px] text-muted">
                          {ok ? copy[p].body : fmt(t.availableRange, { min: money(PROVIDER_LIMITS[p].min), max: money(PROVIDER_LIMITS[p].max) })}
                        </span>
                      </span>
                      <QuarterRing paid={1} className="size-8" />
                    </button>
                  );
                })}
              </div>
            </Bezel>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <Bezel innerClassName="p-6 md:p-8">
                <p className="font-display text-3xl italic">{t.yourBag}</p>
                <ul className="mt-6 space-y-4">
                  {lines.map((l) => (
                    <li key={l.productId} className="flex items-center gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-sand">
                        {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />}
                        <span className="absolute end-0 top-0 flex size-5 items-center justify-center rounded-full bg-ink text-[10px] text-paper">{l.quantity}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{localized(l, "title", lang)}</p>
                        <p className="text-xs text-muted">{l.merchantName}</p>
                      </div>
                      <span className="text-sm tabular-nums">{money(l.price * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 space-y-2 border-t border-ink/[0.06] pt-5 text-sm">
                  <div className="flex justify-between text-muted">
                    <span>{t.deliveryFee}</span>
                    <span>{t.free}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span>
                      {t.total} <span className="text-[11px] text-muted">({t.vatIncluded})</span>
                    </span>
                    <span className="font-display text-3xl">{money(total)}</span>
                  </div>
                </div>
                <motion.div
                  key={provider}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ease: expo, duration: 0.6 }}
                  className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-cream/70 p-3 text-center"
                >
                  {t.months.map((l, i) => (
                    <div key={l}>
                      <p className={cn("text-[13px] tabular-nums", i === 0 && "font-semibold text-ember")}>{money(per, { decimals: true })}</p>
                      <p className="text-[10px] text-muted">{l}</p>
                    </div>
                  ))}
                </motion.div>
                <Button type="submit" variant="ink" size="lg" disabled={busy || needsLogin || !providerAvailable(provider, total)} className="mt-6 w-full justify-between">
                  {busy ? t.connecting : fmt(t.continueWith, { provider: name })}
                </Button>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
                  <Lock weight="light" className="size-3.5" /> {fmt(t.confirmOn, { provider: name })}
                </p>
              </Bezel>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
