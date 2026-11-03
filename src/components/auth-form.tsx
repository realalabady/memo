"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Crown, Storefront, User } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { Bezel, Button, Field } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth/auth-provider";
import type { Role } from "@/lib/types";

const home: Record<Role, string> = { admin: "/admin", merchant: "/merchant", customer: "/account" };

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { signIn, signUp, signInWithGoogle, enterDemo, demo, profile } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) router.replace(next ?? home[profile.role]);
  }, [profile, next, router]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error((err as Error).message.replace("Firebase: ", ""));
      setBusy(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    run(() => (mode === "login" ? signIn(email, password) : signUp(String(f.get("name")), email, password)));
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-16">
      <Reveal className="w-full max-w-md">
        <Link href="/" className="mb-10 flex justify-center">
          <Logo />
        </Link>
        <Bezel innerClassName="p-8">
          <h1 className="font-display text-5xl leading-none">
            {mode === "login" ? (
              <>
                Welcome <span className="italic">back.</span>
              </>
            ) : (
              <>
                Join <span className="italic">memo.</span>
              </>
            )}
          </h1>

          {demo ? (
            <div className="mt-8 space-y-2">
              <p className="mb-4 text-sm text-muted">Demo mode — pick a role to explore the dashboards with sample data.</p>
              {(
                [
                  { role: "admin", label: "Enter as Admin", sub: "Ledger, payouts, merchants", icon: Crown },
                  { role: "merchant", label: "Enter as Merchant", sub: "Atelier Najd store", icon: Storefront },
                  { role: "customer", label: "Enter as Customer", sub: "Orders & checkout", icon: User },
                ] as const
              ).map(({ role, label, sub, icon: Icon }) => (
                <button
                  key={role}
                  onClick={() => enterDemo(role)}
                  className="group flex w-full items-center gap-4 rounded-3xl p-4 text-left ring-1 ring-ink/10 transition duration-500 ease-[var(--ease-fluid)] hover:bg-cream"
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
              <form onSubmit={submit} className="mt-8 space-y-4">
                {mode === "signup" && <Field label="Full name" name="name" required autoComplete="name" />}
                <Field label="Email" name="email" type="email" required autoComplete="email" />
                <Field label="Password" name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                <Button type="submit" disabled={busy} className="w-full justify-between">
                  {mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <div className="my-6 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
              </div>
              <Button variant="paper" trailing={false} disabled={busy} onClick={() => run(signInWithGoogle)} className="w-full">
                Continue with Google
              </Button>
              <p className="mt-6 text-center text-sm text-muted">
                {mode === "login" ? "New here? " : "Already have an account? "}
                <Link href={mode === "login" ? "/signup" : "/login"} className="text-ink underline underline-offset-4">
                  {mode === "login" ? "Create an account" : "Sign in"}
                </Link>
              </p>
            </>
          )}
        </Bezel>
      </Reveal>
    </div>
  );
}
