"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Suspense, useEffect, type ReactNode } from "react";
import { SignOut, type Icon } from "@phosphor-icons/react";
import { LogoMark } from "@/components/brand/logo";
import { expo } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth/auth-provider";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

type ShellProps = { role: Role; title: string; nav: NavItem[]; children: ReactNode };

function ShellLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <LogoMark className="size-10 animate-pulse" />
    </div>
  );
}

// usePathname() is request data on dynamic routes, so the shell streams in behind Suspense.
export function DashboardShell(props: ShellProps) {
  return (
    <Suspense fallback={<ShellLoader />}>
      <Shell {...props} />
    </Suspense>
  );
}

function Shell({ role, title, nav, children }: ShellProps) {
  const { profile, loading, signOut, demo } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = profile?.role === role || (role === "merchant" && profile?.role === "admin");

  useEffect(() => {
    if (loading) return;
    if (!profile) router.replace(`/login?next=${pathname}`);
    else if (!allowed) router.replace(role === "merchant" ? "/sell" : "/");
  }, [loading, profile, allowed, router, pathname, role]);

  if (loading || !allowed) return <ShellLoader />;

  return (
    <div className="min-h-[100dvh] bg-cream/40 md:flex">
      {/* Floating ink island sidebar */}
      <aside className="sticky top-0 z-30 p-3 md:h-[100dvh] md:w-64 md:shrink-0">
        <div className="flex h-full flex-row items-center gap-2 overflow-x-auto rounded-[1.75rem] bg-ink p-2 text-paper shadow-[var(--shadow-float)] md:flex-col md:items-stretch md:overflow-visible md:p-3">
          <Link href="/" className="hidden items-center gap-2 px-3 pb-6 pt-3 md:flex">
            <LogoMark className="size-6 text-paper" />
            <span className="font-display text-2xl italic">memo</span>
            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-paper/60">{title}</span>
          </Link>
          <nav className="flex flex-row gap-1 md:flex-col">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === pathname || (href !== `/${role}` && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-[13px] transition-colors duration-300",
                    active ? "text-ink" : "text-paper/60 hover:text-paper",
                  )}
                >
                  {active && <motion.span layoutId={`nav-${role}`} className="absolute inset-0 rounded-full bg-paper" transition={{ ease: expo, duration: 0.6 }} />}
                  <Icon weight="light" className="relative size-[18px]" />
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden space-y-2 md:block">
            {demo && <p className="rounded-2xl bg-white/5 px-3 py-2 text-[11px] text-paper/50">Demo mode · sample data</p>}
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-ember text-sm font-medium">
                {(profile?.displayName ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{profile?.displayName}</p>
                <p className="truncate text-[11px] text-paper/50">{profile?.email}</p>
              </div>
              <button aria-label="Sign out" onClick={() => signOut().then(() => router.push("/"))} className="text-paper/50 hover:text-paper">
                <SignOut weight="light" className="size-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-16 pt-4 md:px-8 md:pt-10">{children}</main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: ReactNode; actions?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: expo }}
      className="mb-10 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
        <h1 className="font-display mt-3 text-5xl leading-[0.95] md:text-6xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}
