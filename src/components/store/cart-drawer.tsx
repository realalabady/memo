"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "@phosphor-icons/react";
import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/primitives";
import { expo, fluid } from "@/components/ui/motion";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { cartTotal, useCart } from "@/lib/store/cart";
import { installment } from "@/lib/utils";

export function CartDrawer() {
  const t = useT().cart;
  const common = useT().common;
  const { money, lang } = useFormat();
  const { lines, open, setOpen, setQty, remove } = useCart();
  const total = cartTotal(lines);
  // The drawer slides in from the inline-end edge: right in English, left in Arabic.
  const offscreen = lang === "ar" ? "-105%" : "105%";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            role="dialog"
            aria-label={t.title}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ duration: 0.7, ease: fluid }}
            className="fixed inset-y-2 end-2 z-50 flex w-[calc(100%-1rem)] max-w-md flex-col rounded-[2rem] bg-paper p-2 shadow-[var(--shadow-float)] ring-1 ring-ink/[0.06]"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <h2 className="font-display text-3xl italic">{t.title}</h2>
              <button onClick={() => setOpen(false)} aria-label={t.close} className="flex size-10 items-center justify-center rounded-full bg-ink/5 transition hover:rotate-90 duration-500">
                <X weight="light" className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-2">
              {lines.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
                  <p className="font-display text-2xl italic text-ink">{t.emptyTitle}</p>
                  <p className="max-w-56 text-sm">{t.emptyBody}</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {lines.map((l, i) => (
                  <motion.div
                    key={l.productId}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04, ease: expo, duration: 0.6 } }}
                    exit={{ opacity: 0, x: lang === "ar" ? -40 : 40 }}
                    className="flex gap-4 rounded-3xl bg-cream/60 p-2"
                  >
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-[1.1rem] bg-sand">
                      {l.image && <Image src={l.image} alt={localized(l, "title", lang)} fill sizes="96px" className="object-cover" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col py-1 pe-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{localized(l, "title", lang)}</p>
                          <p className="text-xs text-muted">{l.merchantName}</p>
                        </div>
                        <button onClick={() => remove(l.productId)} className="text-xs text-muted underline-offset-2 hover:underline">
                          {common.remove}
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-full bg-paper p-1 ring-1 ring-ink/5">
                          <button aria-label={t.decrease} onClick={() => setQty(l.productId, l.quantity - 1)} className="flex size-7 items-center justify-center rounded-full hover:bg-ink/5">
                            <Minus className="size-3" />
                          </button>
                          <span className="w-5 text-center text-sm tabular-nums">{l.quantity}</span>
                          <button aria-label={t.increase} onClick={() => setQty(l.productId, l.quantity + 1)} className="flex size-7 items-center justify-center rounded-full hover:bg-ink/5">
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <span className="text-sm tabular-nums">{money(l.price * l.quantity)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {lines.length > 0 && (
              <div className="mt-2 rounded-[1.6rem] bg-ink p-5 text-paper">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-paper/60">{t.total}</span>
                  <span className="font-display text-3xl">{money(total)}</span>
                </div>
                <p className="mt-1 text-xs text-paper/60">
                  {t.orPayments} <span className="text-paper">{money(installment(total), { decimals: true })}</span> {t.noInterest}
                </p>
                <ButtonLink href="/checkout" variant="ember" className="mt-4 w-full justify-between" onClick={() => setOpen(false)}>
                  {t.checkout}
                </ButtonLink>
                <Link href="/shop" onClick={() => setOpen(false)} className="mt-3 block text-center text-xs text-paper/60 hover:text-paper">
                  {t.keepBrowsing}
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
