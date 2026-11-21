"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { QuarterRing } from "@/components/store/installments";
import { Reveal, SplitHeadline, Stagger, StaggerItem } from "@/components/ui/motion";
import { Bezel, Button, ButtonLink, Eyebrow, Field, FieldError, FormError, TextArea } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth/auth-provider";
import { applyAsMerchant } from "@/lib/data/mutations";
import { FORM, friendlyError, useFormErrors } from "@/lib/form-errors";
import type { BusinessType } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SellPage() {
  const t = useT().sell;
  const { user, merchant, profile, demo, emailVerified, resendVerification, refreshVerification } = useAuth();
  const account = useT().account;
  const [checking, setChecking] = useState(false);
  const validation = useT().validation;
  const common = useT().common;
  const [busy, setBusy] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const form = useFormErrors();
  const rejected = merchant?.status === "rejected";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (!form.validate(e.currentTarget)) return;
    if (!businessType) {
      form.setError("businessType", validation.required);
      return;
    }
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
        businessType,
        crNumber: get("crNumber"),
        freelanceNumber: get("freelanceNumber").toUpperCase(),
        vatNumber: get("vatNumber"),
        acceptTerms: f.get("acceptTerms") === "on",
      });
      toast(t.sent);
    } catch (err) {
      form.setError(FORM, friendlyError(err, validation, common.somethingWrong));
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
              <form onSubmit={submit} onInput={form.clear} noValidate className="space-y-4">
                <p className="font-display text-4xl italic">{t.applyTitle}</p>
                {rejected && (
                  <div className="rounded-2xl bg-ember-soft p-4 text-sm">
                    <p className="font-medium">{t.rejected}</p>
                    {merchant?.rejectionReason && <p className="mt-1">{fmt(t.rejectedReason, { reason: merchant.rejectionReason })}</p>}
                    <p className="mt-1 text-ink/70">{t.reapply}</p>
                  </div>
                )}
                {!demo && !emailVerified && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ember-soft p-4 text-sm">
                    <span>{fmt(account.verifyBody, { email: user.email })}</span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => resendVerification().then(() => toast(account.verifySent)).catch((err) => form.setError(FORM, (err as Error).message))}
                        className="rounded-full px-4 py-2 ring-1 ring-ink/20"
                      >
                        {account.resend}
                      </button>
                      <button
                        type="button"
                        disabled={checking}
                        onClick={() => {
                          setChecking(true);
                          refreshVerification()
                            .then((ok) => (ok ? form.reset() : form.setError(FORM, account.notVerifiedYet)))
                            .finally(() => setChecking(false));
                        }}
                        className="rounded-full bg-ink px-4 py-2 text-paper disabled:opacity-60"
                      >
                        {account.verified}
                      </button>
                    </span>
                  </div>
                )}
                <Field label={t.storeName} name="storeName" required minLength={2} maxLength={60} defaultValue={merchant?.storeName} error={form.errors.storeName} />
                <Field label={t.tagline} name="tagline" placeholder={t.taglinePlaceholder} maxLength={120} defaultValue={merchant?.tagline} error={form.errors.tagline} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.city} name="city" required defaultValue={merchant?.city} error={form.errors.city} />
                  <Field label={t.mobile} name="phone" type="tel" dir="ltr" required minLength={8} maxLength={20} placeholder="+9665XXXXXXXX" error={form.errors.phone} />
                </div>

                <fieldset>
                  <legend className={cn("mb-2 text-[13px] font-medium", form.errors.businessType ? "text-ember" : "text-ink/80")}>{t.businessType}</legend>
                  <div role="radiogroup" className="grid grid-cols-3 gap-2 rounded-2xl bg-ink/[0.03] p-1 ring-1 ring-ink/[0.06]">
                    {(
                      [
                        ["cr", t.businessCr],
                        ["freelance", t.businessFreelance],
                        ["none", t.businessNone],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={businessType === value}
                        onClick={() => {
                          setBusinessType(value);
                          form.reset();
                        }}
                        className={cn(
                          "rounded-[0.8rem] px-2 py-2.5 text-[13px] transition",
                          businessType === value ? "bg-ink text-paper shadow-[var(--shadow-float)]" : "text-ink/70 hover:bg-paper",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.errors.businessType && <p role="alert" className="pt-1.5 text-xs text-ember">{form.errors.businessType}</p>}
                </fieldset>

                {/* keyed so switching type starts the number field empty */}
                {businessType === "cr" && (
                  <div key="cr" className="grid gap-4 transition duration-300 ease-out-expo starting:-translate-y-1 starting:opacity-0 sm:grid-cols-2">
                    <Field label={t.crNumber} name="crNumber" dir="ltr" inputMode="numeric" required pattern="7[0-9]{9}" maxLength={10} placeholder="7XXXXXXXXX" title={t.crHint} error={form.errors.crNumber} />
                    <Field label={t.vatNumber} name="vatNumber" dir="ltr" inputMode="numeric" pattern="[0-9]{15}" maxLength={15} placeholder="3XXXXXXXXXXXXX3" title={t.vatHint} error={form.errors.vatNumber} />
                  </div>
                )}
                {businessType === "freelance" && (
                  <div key="freelance" className="grid gap-4 transition duration-300 ease-out-expo starting:-translate-y-1 starting:opacity-0 sm:grid-cols-2">
                    <Field label={t.freelanceNumber} name="freelanceNumber" dir="ltr" required pattern="[Ff][Ll]-?[0-9]{6,12}" maxLength={15} placeholder="FL-XXXXXXXXX" title={t.freelanceHint} autoCapitalize="characters" style={{ textTransform: "uppercase" }} error={form.errors.freelanceNumber} />
                    <Field label={t.vatNumber} name="vatNumber" dir="ltr" inputMode="numeric" pattern="[0-9]{15}" maxLength={15} placeholder="3XXXXXXXXXXXXX3" title={t.vatHint} error={form.errors.vatNumber} />
                  </div>
                )}
                {businessType === "none" && (
                  <p className="text-sm text-muted transition duration-300 ease-out-expo starting:opacity-0">{t.businessNoneNote}</p>
                )}

                <TextArea label={t.about} name="bio" required maxLength={2000} defaultValue={merchant?.bio} error={form.errors.bio} />
                <div>
                  <label className={cn("flex items-start gap-3 text-sm", form.errors.acceptTerms ? "text-ember" : "text-ink/70")}>
                    <input type="checkbox" name="acceptTerms" required aria-invalid={form.errors.acceptTerms ? true : undefined} className="mt-0.5 size-4 accent-[var(--color-ink)]" />
                    <span>
                      {t.agree}{" "}
                      <Link href="/terms/merchants" target="_blank" className="underline underline-offset-4">
                        {t.terms}
                      </Link>
                      .
                    </span>
                  </label>
                  <FieldError>{form.errors.acceptTerms}</FieldError>
                </div>
                <FormError>{form.errors[FORM]}</FormError>
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
