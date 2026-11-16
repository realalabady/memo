"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Handbag, UserCircle } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/language-switch";
import { expo } from "@/components/ui/motion";
import { useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { cartCount, useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";

export function StoreNav() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);
  const setCartOpen = useCart((s) => s.setOpen);
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- cart count comes from localStorage
  useEffect(() => setMounted(true), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the overlay on navigation
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: "/shop", label: t.nav.shop },
    { href: "/#categories", label: t.nav.categories },
    { href: "/#how", label: t.nav.payIn4 },
    { href: "/sell", label: t.nav.sell },
  ];
  const count = mounted ? cartCount(lines) : 0;
  const accountHref =
    profile?.role === "admin" ? "/admin" : profile?.role === "merchant" ? "/merchant" : profile ? "/account" : "/login";

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: expo }}
        className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 md:pt-6"
      >
        <nav className="flex w-full max-w-5xl items-center justify-between gap-6 rounded-full bg-paper/70 py-2 ps-5 pe-2 shadow-[var(--shadow-float)] ring-1 ring-ink/[0.06] backdrop-blur-xl md:w-max md:max-w-none">
          <Link href="/" aria-label={t.nav.home}>
            <Logo />
          </Link>
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-[13px] text-ink/70 transition-colors duration-300 hover:bg-ink/[0.05] hover:text-ink",
                    pathname === l.href && "text-ink",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1">
            <LanguageSwitch className="hidden md:block" />
            <Link
              href={accountHref}
              aria-label={t.nav.account}
              className="hidden size-10 items-center justify-center rounded-full transition hover:bg-ink/[0.05] md:flex"
            >
              <UserCircle weight="light" className="size-[22px]" />
            </Link>
            <button
              onClick={() => setCartOpen(true)}
              aria-label={t.nav.openBag}
              className="relative flex h-10 items-center gap-2 rounded-full bg-ink ps-3.5 pe-4 text-paper transition active:scale-[0.97]"
            >
              <Handbag weight="light" className="size-[18px]" />
              <motion.span key={count} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-[13px] tabular-nums">
                {count}
              </motion.span>
            </button>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
              className="relative size-10 rounded-full transition hover:bg-ink/[0.05] md:hidden"
            >
              <span className={cn("absolute inset-x-3 h-px bg-ink transition-all duration-500 ease-[var(--ease-fluid)]", open ? "top-1/2 rotate-45" : "top-[16px]")} />
              <span className={cn("absolute inset-x-3 h-px bg-ink transition-all duration-500 ease-[var(--ease-fluid)]", open ? "top-1/2 -rotate-45" : "top-[23px]")} />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: expo }}
            className="fixed inset-0 z-30 flex flex-col justify-end bg-paper/85 px-6 pb-16 backdrop-blur-3xl md:hidden"
          >
            <ul className="space-y-2">
              {[...links, { href: accountHref, label: profile ? t.nav.account : t.common.signIn }].map((l, i) => (
                <li key={l.href} className="overflow-hidden">
                  <motion.div
                    initial={{ y: 48, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ duration: 0.8, delay: 0.08 + i * 0.05, ease: expo }}
                  >
                    <Link href={l.href} className="font-display text-5xl italic">
                      {l.label}
                    </Link>
                  </motion.div>
                </li>
              ))}
            </ul>
            <LanguageSwitch className="mt-8 self-start px-0 text-base" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
