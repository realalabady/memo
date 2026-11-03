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
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { PROVIDER_LIMITS, providerAvailable } from "@/lib/money";
import { cartTotal, useCart } from "@/lib/store/cart";
import type { Provider } from "@/lib/types";
import { cn, formatSAR, installment } from "@/lib/utils";

const providerCopy: Record<Provider, { title: string; body: string }> = {
  tabby: { title: "Pay in 4 with Tabby", body: "4 interest-free payments. Pay 25% today." },
  tamara: { title: "Split in 4 with Tamara", body: "Pay a quarter now, the rest over 3 months." },
};

export default function CheckoutPage() {
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
          customer,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Checkout failed");
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
        <p className="font-display text-6xl italic">Your bag is empty.</p>
        <Link href="/shop" className="mt-6 text-sm underline underline-offset-4">
          Browse the shelf
        </Link>
      </section>
    );
  }

  const [first = "", ...rest] = (profile?.displayName ?? "").split(" ");

  return (
    <section className="px-4 pb-12 pt-32 md:pt-40">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Checkout</Eyebrow>
        <h1 className="font-display mt-6 text-6xl leading-[0.92] md:text-7xl">
          Almost <span className="italic">yours.</span>
        </h1>

        {needsLogin && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-ember-soft px-6 py-4 text-sm">
            <span>Sign in so we can keep your order and installment status in one place.</span>
            <Link href="/login?next=/checkout" className="rounded-full bg-ink px-4 py-2 text-paper">
              Sign in
            </Link>
          </div>
        )}

        <form onSubmit={submit} className="mt-12 grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            <Bezel innerClassName="p-6 md:p-8">
              <p className="font-display text-3xl italic">Delivery</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="First name" name="firstName" required defaultValue={first} autoComplete="given-name" />
                <Field label="Last name" name="lastName" required defaultValue={rest.join(" ")} autoComplete="family-name" />
                <Field label="Email" name="email" type="email" required defaultValue={user?.email} autoComplete="email" />
                <Field label="Mobile" name="phone" type="tel" required placeholder="+9665XXXXXXXX" autoComplete="tel" />
                <Field label="City" name="city" required placeholder="Riyadh" autoComplete="address-level2" />
                <Field label="Postal code" name="zip" autoComplete="postal-code" />
                <Field className="sm:col-span-2" label="Street address" name="line1" required placeholder="Street, district, building" autoComplete="street-address" />
              </div>
            </Bezel>

            <Bezel innerClassName="p-6 md:p-8">
              <p className="font-display text-3xl italic">Payment</p>
              <p className="mt-1 text-sm text-muted">Every store on memo supports both — the payment runs through memo.</p>
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
                        "relative flex items-center gap-4 rounded-3xl p-4 text-left ring-1 transition-all duration-500 ease-[var(--ease-fluid)] disabled:opacity-50",
                        selected ? "bg-cream ring-ink/30" : "ring-ink/10 hover:bg-cream/50",
                      )}
                    >
                      <span className={cn("flex size-5 items-center justify-center rounded-full ring-1 ring-ink/30", selected && "bg-ink ring-ink")}>
                        {selected && <motion.span layoutId="radio" className="size-2 rounded-full bg-paper" />}
                      </span>
                      <span className="flex-1">
                        <span className="flex items-center gap-2 text-[15px] font-medium">
                          {providerCopy[p].title} <ProviderChip provider={p} />
                        </span>
                        <span className="text-[13px] text-muted">
                          {ok ? providerCopy[p].body : `Available from ${formatSAR(PROVIDER_LIMITS[p].min)} to ${formatSAR(PROVIDER_LIMITS[p].max)}`}
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
                <p className="font-display text-3xl italic">Your bag</p>
                <ul className="mt-6 space-y-4">
                  {lines.map((l) => (
                    <li key={l.productId} className="flex items-center gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-sand">
                        {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />}
                        <span className="absolute -right-0 -top-0 flex size-5 items-center justify-center rounded-full bg-ink text-[10px] text-paper">{l.quantity}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{l.title}</p>
                        <p className="text-xs text-muted">{l.merchantName}</p>
                      </div>
                      <span className="text-sm tabular-nums">{formatSAR(l.price * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 space-y-2 border-t border-ink/[0.06] pt-5 text-sm">
                  <div className="flex justify-between text-muted"><span>Delivery</span><span>Free</span></div>
                  <div className="flex items-baseline justify-between">
                    <span>Total</span>
                    <span className="font-display text-3xl">{formatSAR(total)}</span>
                  </div>
                </div>
                <motion.div
                  key={provider}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ease: expo, duration: 0.6 }}
                  className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-cream/70 p-3 text-center"
                >
                  {["Today", "Month 1", "Month 2", "Month 3"].map((l, i) => (
                    <div key={l}>
                      <p className={cn("text-[13px] tabular-nums", i === 0 && "font-semibold text-ember")}>{formatSAR(per, { decimals: true })}</p>
                      <p className="text-[10px] text-muted">{l}</p>
                    </div>
                  ))}
                </motion.div>
                <Button type="submit" variant="ink" size="lg" disabled={busy || needsLogin || !providerAvailable(provider, total)} className="mt-6 w-full justify-between">
                  {busy ? "Connecting…" : `Continue with ${provider === "tabby" ? "Tabby" : "Tamara"}`}
                </Button>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
                  <Lock weight="light" className="size-3.5" /> You&apos;ll confirm on {provider === "tabby" ? "Tabby" : "Tamara"}&apos;s secure page
                </p>
              </Bezel>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
