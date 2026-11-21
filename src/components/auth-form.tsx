"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Crown, Storefront, User } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { Bezel, Button, Field, FormError } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { useT } from "@/i18n/client";
import { safeNext, useAuth } from "@/lib/auth/auth-provider";
import { FORM, authError, useFormErrors } from "@/lib/form-errors";
import { landing } from "@/lib/auth/landing";

/** Dashboards are gated on the server by the session cookie: open them as a fresh page. */
const serverGated = (path: string) => /^\/(admin|merchant)(\/|$|\?)/.test(path);

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = useT().auth;
  const common = useT().common;
  const { signIn, signUp, signInWithGoogle, enterDemo, demo, profile, resetPassword } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [busy, setBusy] = useState(false);
  const form = useFormErrors();
  /** Set by a sign-in on this page (not when an already signed-in visitor lands here). */
  const signedInHere = useRef(false);

  useEffect(() => {
    if (!profile) return;
    const to = landing(profile.role, next);
    // A soft navigation could reuse a router-cache entry from before sign-in that redirects back
    // here, leaving the button spinning. Only after an explicit sign-in, so a failed session can't loop.
    if (signedInHere.current && serverGated(to)) window.location.assign(to);
    else router.replace(to);
  }, [profile, next, router]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    form.reset();
    // Before awaiting: the profile (and the redirect effect) can arrive before fn() resolves.
    signedInHere.current = true;
    try {
      await fn();
    } catch (err) {
      signedInHere.current = false;
      const e = authError(err, t);
      if (e) form.setError(e.field, e.message);
      setBusy(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.validate(e.currentTarget)) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    run(() => (mode === "login" ? signIn(email, password) : signUp(String(f.get("name")), email, password)));
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-16">
      <Reveal className="w-full max-w-md">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink/60 ring-1 ring-ink/10 transition hover:bg-cream hover:text-ink">
            <ArrowLeft weight="light" className="size-4 rtl:-scale-x-100" /> {t.backToStore}
          </Link>
          <Link href="/" aria-label={t.backToStore}>
            <Logo />
          </Link>
        </div>
        <Bezel innerClassName="p-8">
          <h1 className="font-display text-5xl leading-none">
            {mode === "login" ? (
              <>
                {t.welcome} <span className="italic">{t.welcomeEm}</span>
              </>
            ) : (
              <>
                {t.join} <span className="italic">{t.joinEm}</span>
              </>
            )}
          </h1>

          {demo ? (
            <div className="mt-8 space-y-2">
              <p className="mb-4 text-sm text-muted">{t.demoNote}</p>
              {(
                [
                  { role: "admin", label: t.enterAdmin, sub: t.adminSub, icon: Crown },
                  { role: "merchant", label: t.enterMerchant, sub: t.merchantSub, icon: Storefront },
                  { role: "customer", label: t.enterCustomer, sub: t.customerSub, icon: User },
                ] as const
              ).map(({ role, label, sub, icon: Icon }) => (
                <button
                  key={role}
                  onClick={() => enterDemo(role)}
                  className="group flex w-full items-center gap-4 rounded-3xl p-4 text-start ring-1 ring-ink/10 transition duration-500 ease-[var(--ease-fluid)] hover:bg-cream"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-ink text-paper transition group-hover:bg-ember">
                    <Icon weight="light" className="size-5" />
                  </span>
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="text-sm text-muted">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <form onSubmit={submit} onInput={form.clear} noValidate className="mt-8 space-y-4">
                <FormError>{form.errors[FORM]}</FormError>
                {mode === "signup" && <Field label={t.fullName} name="name" required autoComplete="name" error={form.errors.name} />}
                <Field label={t.email} name="email" type="email" dir="ltr" required autoComplete="email" error={form.errors.email} />
                <Field label={t.password} name="password" type="password" dir="ltr" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} error={form.errors.password} />
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      const email = String(new FormData(e.currentTarget.form!).get("email") ?? "").trim();
                      if (!email) return form.setError("email", t.enterEmailFirst);
                      resetPassword(email).then(() => toast(t.resetSent));
                    }}
                    className="block text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    {t.forgot}
                  </button>
                )}
                <Button type="submit" disabled={busy} className="w-full justify-between">
                  {mode === "login" ? common.signIn : t.createAccount}
                </Button>
              </form>
              <div className="my-6 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-ink/10" /> {t.or} <span className="h-px flex-1 bg-ink/10" />
              </div>
              <Button variant="paper" trailing={false} disabled={busy} onClick={() => run(signInWithGoogle)} className="w-full">
                {t.google}
              </Button>
              <p className="mt-6 text-center text-sm text-muted">
                {mode === "login" ? t.newHere : t.haveAccount}{" "}
                <Link href={mode === "login" ? "/signup" : "/login"} className="text-ink underline underline-offset-4">
                  {mode === "login" ? t.createLink : common.signIn}
                </Link>
              </p>
            </>
          )}
        </Bezel>
      </Reveal>
    </div>
  );
}
