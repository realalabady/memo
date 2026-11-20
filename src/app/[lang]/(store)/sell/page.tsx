"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { QuarterRing } from "@/components/store/installments";
import { Reveal, SplitHeadline, Stagger, StaggerItem } from "@/components/ui/motion";
import { Bezel, Button, ButtonLink, Eyebrow, Field, TextArea } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth/auth-provider";
import { applyAsMerchant } from "@/lib/data/mutations";

export default function SellPage() {
  const t = useT().sell;
  const { user, merchant, profile, demo, emailVerified } = useAuth();
  const [busy, setBusy] = useState(false);
  const rejected = merchant?.status === "rejected";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    try {
      await applyAsMerchant(user.uid, {
        storeName: get("storeName"),
        tagline: get("tagline"),
        bio: get("bio"),
        city: get("city"),
        phone: get("phone"),
        crNumber: get("crNumber"),
        vatNumber: get("vatNumber"),
        acceptTerms: f.get("acceptTerms") === "on",
      });
      toast(t.sent);
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
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="font-display mt-6 text-6xl leading-[0.9] md:text-8xl">
            <SplitHeadline lines={[t.title, <span key="x" className="italic text-ember">{t.titleEm}</span>]} />
          </h1>
          <p className="mt-8 max-w-md text-lg text-ink/60">{t.body}</p>
          <Stagger className="mt-12 space-y-3">
            {t.steps.map((s, i) => (
              <StaggerItem key={s.t}>
                <div className="flex items-start gap-4 rounded-3xl p-4 ring-1 ring-ink/[0.06]">
                  <QuarterRing paid={i + 1} className="size-9 shrink-0" />
                  <div>
                    <p className="font-medium">{s.t}</p>
                    <p className="text-sm text-muted">{s.d}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal delay={0.15} className="lg:col-span-6">
          <Bezel innerClassName="p-6 md:p-10">
            {merchant?.status === "approved" || (profile?.role === "merchant" && !rejected) ? (
              <div className="py-10 text-center">
                <p className="font-display text-4xl italic">{t.live}</p>
                <ButtonLink href="/merchant" className="mt-8">{t.openHub}</ButtonLink>
              </div>
            ) : merchant?.status === "pending" ? (
              <div className="py-10 text-center">
                <p className="font-display text-4xl italic">{t.received}</p>
                <p className="mt-3 text-muted">{t.reviewTime}</p>
              </div>
            ) : merchant?.status === "suspended" ? (
              <div className="py-10 text-center">
                <p className="font-display text-4xl italic">{t.suspended}</p>
                <p className="mt-3 text-muted">{t.suspendedBody}</p>
              </div>
            ) : !user ? (
              <div className="py-10 text-center">
                <p className="font-display text-4xl italic">{t.createFirst}</p>
                <p className="mt-3 text-muted">{demo ? t.demoHint : t.thenApply}</p>
                <ButtonLink href={demo ? "/login" : "/signup?next=/sell"} className="mt-8">
                  {demo ? t.chooseDemo : t.signUp}
                </ButtonLink>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <p className="font-display text-4xl italic">{t.applyTitle}</p>
                {rejected && (
                  <div className="rounded-2xl bg-ember-soft p-4 text-sm">
                    <p className="font-medium">{t.rejected}</p>
                    {merchant?.rejectionReason && <p className="mt-1">{fmt(t.rejectedReason, { reason: merchant.rejectionReason })}</p>}
                    <p className="mt-1 text-ink/70">{t.reapply}</p>
                  </div>
                )}
                {!demo && !emailVerified && <p className="rounded-2xl bg-ember-soft p-4 text-sm">{t.verifyFirst}</p>}
                <Field label={t.storeName} name="storeName" required minLength={2} maxLength={60} defaultValue={merchant?.storeName} />
                <Field label={t.tagline} name="tagline" placeholder={t.taglinePlaceholder} maxLength={120} defaultValue={merchant?.tagline} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.city} name="city" required defaultValue={merchant?.city} />
                  <Field label={t.mobile} name="phone" type="tel" dir="ltr" required minLength={8} maxLength={20} placeholder="+9665XXXXXXXX" />
                  <Field label={t.crNumber} name="crNumber" dir="ltr" inputMode="numeric" required pattern="\d{10}" maxLength={10} />
                  <Field label={t.vatNumber} name="vatNumber" dir="ltr" inputMode="numeric" pattern="\d{15}" maxLength={15} />
                </div>
                <TextArea label={t.about} name="bio" required maxLength={2000} defaultValue={merchant?.bio} />
                <label className="flex items-start gap-3 text-sm text-ink/70">
                  <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 accent-[var(--color-ink)]" />
                  <span>
                    {t.agree}{" "}
                    <Link href="/terms/merchants" target="_blank" className="underline underline-offset-4">
                      {t.terms}
                    </Link>
                    .
                  </span>
                </label>
                <Button type="submit" disabled={busy || (!demo && !emailVerified)} className="w-full justify-between">
                  {t.submit}
                </Button>
              </form>
            )}
          </Bezel>
        </Reveal>
      </div>
    </section>
  );
}
