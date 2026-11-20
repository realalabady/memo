"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { List, SignOut, X, type Icon } from "@phosphor-icons/react";
import { LogoMark } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/language-switch";
import { expo } from "@/components/ui/motion";
import { stripLocale } from "@/i18n/config";
import { useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

type ShellProps = { role: Role; title: string; nav: NavItem[]; children: ReactNode };

export function ShellLoader() {
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

function NavLinks({ nav, role, pathname, layoutId, onNavigate }: { nav: NavItem[]; role: Role; pathname: string; layoutId: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === pathname || (href !== `/${role}` && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-[13px] transition-colors duration-300",
              active ? "text-ink" : "text-paper/60 hover:text-paper",
            )}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-paper" transition={{ ease: expo, duration: 0.6 }} />}
            <Icon weight="light" className="relative size-[18px]" />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AccountBox() {
  const t = useT().dash;
  const { profile, signOut, demo } = useAuth();
  const router = useRouter();
  return (
    <div className="space-y-2">
      {demo && <p className="rounded-2xl bg-white/5 px-3 py-2 text-[11px] text-paper/50">{t.demoBadge}</p>}
      <LanguageSwitch className="block text-paper/60 hover:bg-white/10 hover:text-paper" />
      <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ember text-sm font-medium">
          {(profile?.displayName ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px]">{profile?.displayName}</p>
          <p className="truncate text-[11px] text-paper/50">{profile?.email}</p>
        </div>
        <button aria-label={t.signOut} onClick={() => signOut().then(() => router.push("/"))} className="text-paper/50 hover:text-paper">
          <SignOut weight="light" className="size-[18px] rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

function Brand({ title }: { title: string }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <LogoMark className="size-6 text-paper" />
      <span className="font-display text-2xl italic">memo</span>
      <span className="ms-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-paper/60">{title}</span>
    </Link>
  );
}

function Shell({ role, title, nav, children }: ShellProps) {
  const t = useT().dash;
  const { profile, loading } = useAuth();
  const rawPathname = usePathname();
  const pathname = stripLocale(rawPathname);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const allowed = profile?.role === role || (role === "merchant" && profile?.role === "admin");
  const current = nav.find((n) => n.href === pathname || (n.href !== `/${role}` && pathname.startsWith(n.href)));

  useEffect(() => {
    if (loading) return;
    if (!profile) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(role === "merchant" ? "/sell" : "/");
  }, [loading, profile, allowed, router, pathname, role]);

  // Phone menu: Escape closes it, and the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  if (loading || !allowed) return <ShellLoader />;

  return (
    <div className="min-h-[100dvh] bg-cream/40 md:flex">
      {/* Phone / small tablet: top bar + slide-out menu */}
      <header className="sticky top-0 z-30 p-3 md:hidden">
        <div className="flex items-center gap-3 rounded-[1.5rem] bg-ink px-3 py-2 text-paper shadow-[var(--shadow-float)]">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.openMenu}
            aria-expanded={menuOpen}
            aria-controls="dash-menu"
            className="flex size-10 items-center justify-center rounded-full bg-white/10"
          >
            <List weight="light" className="size-5" />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm">{current?.label ?? title}</span>
          <Link href="/" aria-label="memo">
            <LogoMark className="size-6 text-paper" />
          </Link>
        </div>
      </header>
      <div className={cn("fixed inset-0 z-40 md:hidden", menuOpen ? "" : "pointer-events-none")} aria-hidden={!menuOpen}>
        <div onClick={() => setMenuOpen(false)} className={cn("absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300", menuOpen ? "opacity-100" : "opacity-0")} />
        <div
          id="dash-menu"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          inert={!menuOpen}
          className={cn(
            "absolute inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col gap-4 overflow-y-auto bg-ink p-4 text-paper shadow-[var(--shadow-float)] transition-transform duration-500 ease-[var(--ease-fluid)]",
            menuOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            <Brand title={title} />
            <button type="button" onClick={() => setMenuOpen(false)} aria-label={t.closeMenu} className="flex size-9 items-center justify-center rounded-full bg-white/10">
              <X weight="light" className="size-4" />
            </button>
          </div>
          <NavLinks nav={nav} role={role} pathname={pathname} layoutId={`nav-m-${role}`} onNavigate={() => setMenuOpen(false)} />
          <div className="mt-auto">
            <AccountBox />
          </div>
        </div>
      </div>

      {/* Desktop: floating ink island sidebar */}
      <aside className="sticky top-0 z-30 hidden h-[100dvh] w-64 shrink-0 p-3 md:block">
        <div className="flex h-full flex-col gap-2 rounded-[1.75rem] bg-ink p-3 text-paper shadow-[var(--shadow-float)]">
          <div className="px-3 pb-4 pt-3">
            <Brand title={title} />
          </div>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
            <NavLinks nav={nav} role={role} pathname={pathname} layoutId={`nav-${role}`} />
          </div>
          <AccountBox />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-16 pt-2 md:px-8 md:pt-10">{children}</main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: ReactNode; actions?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: expo }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10"
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
        <h1 className="font-display mt-3 text-4xl leading-[0.95] sm:text-5xl md:text-6xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}
