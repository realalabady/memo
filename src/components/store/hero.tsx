"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ButtonLink, Eyebrow, ProviderChip } from "@/components/ui/primitives";
import { expo, SplitHeadline } from "@/components/ui/motion";
import type { Product } from "@/lib/types";
import { formatSAR, installment } from "@/lib/utils";

/** Editorial split + Z-axis cascade of floating product cards. */
export function Hero({ products }: { products: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const [a, b, c] = products;
  const cards = [
    { p: a, y: y1, cls: "md:left-[4%] md:top-[6%] md:-rotate-[5deg] md:w-[56%] z-10", d: 0.35 },
    { p: b, y: y2, cls: "md:right-0 md:top-[24%] md:rotate-[4deg] md:w-[50%] z-20", d: 0.5 },
    { p: c, y: y3, cls: "md:left-[18%] md:top-[54%] md:-rotate-[2deg] md:w-[46%] z-30", d: 0.65 },
  ].filter((x) => x.p);

  return (
    <section ref={ref} className="relative overflow-hidden px-4 pb-24 pt-32 md:min-h-[100dvh] md:pt-40">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-ember/10 blur-[120px]" />
      <div className="mx-auto grid max-w-7xl items-center gap-16 md:grid-cols-2">
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: expo }}>
            <Eyebrow>Tabby & Tamara on every store</Eyebrow>
          </motion.div>
          <h1 className="font-display mt-8 text-[clamp(3.4rem,8vw,7.5rem)] leading-[0.9]">
            <SplitHeadline
              delay={0.1}
              lines={[
                "Buy what",
                "you love.",
                <span key="i" className="italic text-ember">
                  Pay in four.
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
            Independent stores from across the Kingdom, one bag, one checkout. Split anything into four interest-free
            payments — even when the store doesn&apos;t offer it.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.62, ease: expo }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <ButtonLink href="/shop" size="lg">
              Start shopping
            </ButtonLink>
            <Link href="/sell" className="rounded-full px-5 py-3 text-sm text-ink/70 transition hover:bg-ink/5 hover:text-ink">
              Open a store →
            </Link>
          </motion.div>
        </div>

        <div className="relative grid grid-cols-1 gap-6 md:block md:h-[640px]">
          {cards.map(({ p, y, cls, d }) => (
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
                  <Image src={p.images[0]} alt={p.title} fill priority sizes="(min-width: 768px) 30vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-fluid)] group-hover:scale-105" />
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="text-[12px] text-muted">
                      4 × {formatSAR(installment(p.price), { decimals: true })}
                    </p>
                  </div>
                  <ProviderChip provider={p.price % 2 ? "tamara" : "tabby"} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
