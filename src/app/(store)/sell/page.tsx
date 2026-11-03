"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { QuarterRing } from "@/components/store/installments";
import { Reveal, SplitHeadline, Stagger, StaggerItem } from "@/components/ui/motion";
import { Bezel, Button, ButtonLink, Eyebrow, Field, TextArea } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth/auth-provider";
import { applyAsMerchant } from "@/lib/data/mutations";
import { slugify } from "@/lib/utils";

export default function SellPage() {
  const { user, merchant, profile, demo } = useAuth();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const storeName = String(f.get("storeName"));
    setBusy(true);
    try {
      await applyAsMerchant(user.uid, {
        storeName,
        slug: `${slugify(storeName)}-${user.uid.slice(0, 4).toLowerCase()}`,
        tagline: String(f.get("tagline")),
        bio: String(f.get("bio")),
        city: String(f.get("city")),
        phone: String(f.get("phone")),
        email: user.email,
      });
      toast("Application sent — we'll review it shortly");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Eyebrow>Sell on memo</Eyebrow>
          <h1 className="font-display mt-6 text-6xl leading-[0.9] md:text-8xl">
            <SplitHeadline lines={["Your store,", <span key="x" className="italic text-ember">pay-in-4 ready.</span>]} />
          </h1>
          <p className="mt-8 max-w-md text-lg text-ink/60">
            You don&apos;t need your own Tabby or Tamara contract. Customers pay through memo, and we transfer your share to your IBAN.
          </p>
          <Stagger className="mt-12 space-y-3">
            {[
              ["List products", "Upload photos, set prices and stock from your hub."],
              ["We take the payment", "Tabby & Tamara run on memo's account for every order."],
              ["See every riyal", "Live ledger of each sale, commission and payout."],
              ["Get paid out", "Bank transfers to your IBAN, with a reference for each one."],
            ].map(([t, d], i) => (
              <StaggerItem key={t}>
                <div className="flex items-start gap-4 rounded-3xl p-4 ring-1 ring-ink/[0.06]">
                  <QuarterRing paid={i + 1} className="size-9 shrink-0" />
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="text-sm text-muted">{d}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal delay={0.15} className="lg:col-span-6">
          <Bezel innerClassName="p-6 md:p-10">
            {merchant?.status === "approved" || profile?.role === "merchant" ? (
              <div className="py-10 text-center">
                <p className="font-display text-4xl italic">Your store is live.</p>
                <ButtonLink href="/merchant" className="mt-8">Open merchant hub</ButtonLink>
              </div>
            ) : merchant?.status === "pending" ? (
              <div className="py-10 text-center">
                <p className="font-display text-4xl italic">Application received.</p>
                <p className="mt-3 text-muted">We review new stores within one business day.</p>
              </div>
            ) : !user ? (
              <div className="py-10 text-center">
                <p className="font-display text-4xl italic">Create an account first.</p>
                <p className="mt-3 text-muted">{demo ? "In demo mode, enter as Merchant to explore the hub." : "Then come back here to apply."}</p>
                <ButtonLink href={demo ? "/login" : "/signup?next=/sell"} className="mt-8">
                  {demo ? "Choose a demo role" : "Sign up"}
                </ButtonLink>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <p className="font-display text-4xl italic">Apply to sell</p>
                <Field label="Store name" name="storeName" required />
                <Field label="Tagline" name="tagline" placeholder="One line about what you make" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" name="city" required />
                  <Field label="Mobile" name="phone" type="tel" required />
                </div>
                <TextArea label="About the store" name="bio" required />
                <Button type="submit" disabled={busy} className="w-full justify-between">
                  Submit application
                </Button>
                <p className="text-center text-xs text-muted">
                  By applying you agree to memo&apos;s <Link href="#" className="underline">merchant terms</Link>.
                </p>
              </form>
            )}
          </Bezel>
        </Reveal>
      </div>
    </section>
  );
}
