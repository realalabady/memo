"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ButtonLink, ProviderChip } from "@/components/ui/primitives";
import { expo, SplitHeadline } from "@/components/ui/motion";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import type { Product } from "@/lib/types";
import { installment } from "@/lib/utils";

// Small tilted tiles for the phone layout, stacked like the desktop cascade (logical sides flip in RTL)
const mobileTiles = [
  "absolute end-14 top-0 w-[5.5rem] -rotate-6",
  "absolute end-0 top-5 z-10 w-20 rotate-[5deg]",
  "absolute end-6 top-[5.75rem] z-20 w-[4.5rem] -rotate-2",
];

/** Editorial split + Z-axis cascade of floating product cards. */
export function Hero({ products, copy }: { products: Product[]; copy?: { l1: string; l2: string; l3: string; body: string } }) {
  const dict = useT().hero;
  // Admin-edited copy (settings/storefront) wins; empty lines keep the built-in wording.
  const t = { ...dict, l1: copy?.l1 || dict.l1, l2: copy?.l2 || dict.l2, l3: copy?.l3 || dict.l3, body: copy?.body || dict.body };
  const { money, lang } = useFormat();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const [a, b, c] = products;
  const cards = [
    { p: a, y: y1, cls: "md:start-[4%] md:top-[6%] md:-rotate-[5deg] md:w-[56%] z-10", d: 0.35, provider: "tabby" as const },
    { p: b, y: y2, cls: "md:end-0 md:top-[24%] md:rotate-[4deg] md:w-[50%] z-20", d: 0.5, provider: "tamara" as const },
    { p: c, y: y3, cls: "md:start-[18%] md:top-[54%] md:-rotate-[2deg] md:w-[46%] z-30", d: 0.65, provider: "tabby" as const },
  ].filter((x) => x.p && x.p.images?.[0]);

  return (
    <section ref={ref} className="relative overflow-hidden px-4 pb-24 pt-32 md:min-h-[100dvh] md:pt-40">
      <div aria-hidden className="pointer-events-none absolute -end-40 -top-40 size-[640px] rounded-full bg-ember/10 blur-[120px]" />
      <div className="mx-auto grid max-w-7xl items-center gap-16 md:grid-cols-2">
        <div className="relative">
          {/* Mobile: the three products float in the space beside the headline */}
          <div className="pointer-events-none absolute end-0 top-0 z-10 h-40 w-36 md:hidden">
            {cards.map(({ p }, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: [0, i % 2 ? 5 : -5, 0] }}
                transition={{
                  opacity: { duration: 1.1, delay: 0.3 + i * 0.12, ease: expo },
                  scale: { duration: 1.1, delay: 0.3 + i * 0.12, ease: expo },
                  filter: { duration: 1.1, delay: 0.3 + i * 0.12, ease: expo },
                  y: { duration: 5 + i, delay: 1.4, repeat: Infinity, ease: "easeInOut" },
                }}
                className={mobileTiles[i]}
              >
                <Link
                  href={`/product/${p.id}`}
                  aria-label={localized(p, "title", lang)}
                  className="pointer-events-auto relative block aspect-[4/5] overflow-hidden rounded-[1.1rem] bg-sand ring-4 ring-paper shadow-[var(--shadow-float)] transition-transform duration-500 ease-[var(--ease-fluid)] active:scale-95"
                >
                  <Image src={p.images[0]} alt="" fill priority sizes="96px" className="object-cover" />
                </Link>
              </motion.div>
            ))}
          </div>
          <h1 className="font-display relative text-[clamp(3.4rem,8vw,7.5rem)] leading-[0.9]">
            <SplitHeadline
              delay={0.1}
              lines={[
                t.l1,
                t.l2,
                <span key="i" className="italic text-ember">
                  {t.l3}
                </span>,
              ]}
            />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: expo }}
            className="mt-8 max-w-md text-[17px] leading-relaxed text-ink/65"
          >
            {t.body}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.62, ease: expo }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <ButtonLink href="/shop" size="lg">
              {t.cta}
            </ButtonLink>
            <Link href="/sell" className="rounded-full px-5 py-3 text-sm text-ink/70 transition hover:bg-ink/5 hover:text-ink">
              {t.openStore}
            </Link>
          </motion.div>
        </div>

        <div className="relative hidden md:block md:h-[640px]">
          {cards.map(({ p, y, cls, d, provider }) => (
            <motion.div
              key={p.id}
              style={{ y }}
              initial={{ opacity: 0, scale: 0.92, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.2, delay: d, ease: expo }}
              className={`w-full md:absolute ${cls}`}
            >
              <Link href={`/product/${p.id}`} className="group block rounded-[2rem] bg-paper/60 p-1.5 shadow-[var(--shadow-float)] ring-1 ring-ink/[0.06] transition-transform duration-700 ease-[var(--ease-fluid)] hover:-translate-y-2">
                <div className="relative aspect-[5/4] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-sand">
                  <Image src={p.images[0]} alt={localized(p, "title", lang)} fill priority sizes="(min-width: 768px) 30vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-fluid)] group-hover:scale-105" />
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{localized(p, "title", lang)}</p>
                    <p className="text-[12px] text-muted">4 × {money(installment(p.price), { decimals: true })}</p>
                  </div>
                  <ProviderChip provider={provider} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
