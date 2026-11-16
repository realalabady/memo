import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Hero } from "@/components/store/hero";
import { QuarterRing } from "@/components/store/installments";
import { ProductGrid } from "@/components/store/product-card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { ButtonLink, Eyebrow, ProviderChip } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getCategories, getMerchants, getProducts } from "@/lib/server/catalog";
import { cn } from "@/lib/utils";

// Asymmetric bento spans for the category grid
const spans = [
  "md:col-span-7 md:row-span-2",
  "md:col-span-5",
  "md:col-span-5",
  "md:col-span-4",
  "md:col-span-4",
  "md:col-span-4",
];

export default async function HomePage() {
  const [categories, products, merchants, dict, lang] = await Promise.all([
    getCategories(),
    getProducts(),
    getMerchants(),
    getDictionary(),
    getLocale(),
  ]);
  const t = dict.home;
  // One product from each of the first categories, topped up with the newest products.
  const heroPicks = [...new Set([...categories.map((c) => products.find((p) => p.categoryId === c.id)), ...products])]
    .filter((p) => p !== undefined)
    .slice(0, 3);

  return (
    <>
      <Hero products={heroPicks} />

      {/* Marquee */}
      <div className="overflow-hidden border-y border-ink/[0.06] bg-cream/50 py-5">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {[...categories, ...categories, ...categories, ...categories].map((c, i) => (
            <span key={i} className="font-display flex items-center gap-12 text-3xl italic text-ink/70">
              {localized(c, "name", lang)}
              <span className="size-2 rounded-full bg-ember" />
            </span>
          ))}
        </div>
      </div>

      {/* Categories bento */}
      <section id="categories" className="scroll-mt-28 px-4 py-24 md:py-36">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <Eyebrow>{t.categoriesEyebrow}</Eyebrow>
              <h2 className="font-display mt-5 text-5xl leading-[0.95] md:text-7xl">
                {t.categoriesTitle} <span className="italic">{t.categoriesEm}</span>
              </h2>
            </div>
            <p className="max-w-sm text-ink/60">{t.categoriesIntro}</p>
          </Reveal>
          <Stagger className="grid grid-cols-1 gap-4 md:auto-rows-[260px] md:grid-cols-12">
            {categories.map((c, i) => (
              <StaggerItem key={c.id} className={cn("min-h-[260px]", spans[i % spans.length])}>
                <Link href={`/category/${c.slug}`} className="group block h-full rounded-[2rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
                  <div className="relative h-full overflow-hidden rounded-[calc(2rem-0.375rem)] bg-sand">
                    {c.image && (
                      <Image src={c.image} alt={localized(c, "name", lang)} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-[1.6s] ease-[var(--ease-fluid)] group-hover:scale-[1.05]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-paper">
                      <div>
                        <p className="font-display text-4xl italic">{localized(c, "name", lang)}</p>
                        <p className="mt-1 text-sm text-paper/70">{localized(c, "blurb", lang)}</p>
                      </div>
                      <span className="flex size-11 items-center justify-center rounded-full bg-paper/15 backdrop-blur transition-transform duration-500 ease-[var(--ease-fluid)] group-hover:-translate-y-0.5 group-hover:bg-paper group-hover:text-ink">
                        <ArrowUpRight weight="light" className="size-5 rtl:-scale-x-100" />
                      </span>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Featured */}
      <section className="px-4 pb-24 md:pb-36">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-14 flex items-end justify-between gap-6">
            <h2 className="font-display text-5xl leading-[0.95] md:text-7xl">
              {t.landed} <span className="italic">{t.landedEm}</span>
            </h2>
            <Link href="/shop" className="text-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline">
              {t.viewAll}
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <ProductGrid products={products.slice(0, 8)} />
          </Reveal>
        </div>
      </section>

      {/* How pay-in-4 works */}
      <section id="how" className="scroll-mt-28 px-4 pb-24 md:pb-36">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-12">
          <Reveal className="md:col-span-5">
            <Eyebrow>{t.howEyebrow}</Eyebrow>
            <h2 className="font-display mt-5 text-5xl leading-[0.95] md:text-7xl">
              <span className="block">{t.howTitle}</span>
              <span className="block italic text-ember">{t.howEm}</span>
            </h2>
            <p className="mt-6 max-w-md text-ink/60">{t.howBody}</p>
            <div className="mt-8 flex gap-2">
              <ProviderChip provider="tabby" className="px-4 py-1.5 text-sm" />
              <ProviderChip provider="tamara" className="px-4 py-1.5 text-sm" />
            </div>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2 md:col-span-7">
            {t.steps.map((s, i) => (
              <StaggerItem key={s.t}>
                <div className="h-full rounded-[2rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
                  <div className="flex h-full flex-col rounded-[calc(2rem-0.375rem)] bg-paper p-7 shadow-[var(--shadow-inset)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted">0{i + 1}</span>
                      <QuarterRing paid={i + 1} />
                    </div>
                    <p className="font-display mt-10 text-3xl italic">{s.t}</p>
                    <p className="mt-2 text-sm text-ink/60">{s.d}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Stores */}
      <section className="px-4 pb-24 md:pb-36">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-10">
            <h2 className="font-display text-5xl leading-[0.95] md:text-6xl">
              {t.storesTitle} <span className="italic">{t.storesEm}</span>
            </h2>
          </Reveal>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4">
            {merchants.map((m) => (
              <Link key={m.id} href={`/store/${m.slug}`} className="group w-72 shrink-0 snap-start rounded-[2rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
                <div className="rounded-[calc(2rem-0.375rem)] bg-paper p-5 shadow-[var(--shadow-inset)]">
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 overflow-hidden rounded-full bg-sand">
                      {m.logoUrl && <Image src={m.logoUrl} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                    <div>
                      <p className="font-medium">{m.storeName}</p>
                      <p className="text-xs text-muted">{m.city}</p>
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-ink/60">{localized(m, "tagline", lang)}</p>
                  <p className="mt-6 text-xs text-ink/50 transition group-hover:text-ink">{t.visitStore}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Merchant CTA */}
      <section className="px-4">
        <Reveal className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-ink-2 px-6 py-20 text-paper md:px-16 md:py-28">
            <div aria-hidden className="pointer-events-none absolute -bottom-32 -end-20 size-[520px] rounded-full bg-ember/25 blur-[120px]" />
            <div className="relative grid gap-12 md:grid-cols-2 md:items-end">
              <div>
                <Eyebrow dark>{t.merchEyebrow}</Eyebrow>
                <h2 className="font-display mt-6 text-5xl leading-[0.95] md:text-7xl">
                  {t.merchTitle} <span className="italic text-ember">{t.merchEm}</span>
                </h2>
                <p className="mt-6 max-w-md text-paper/60">{t.merchBody}</p>
              </div>
              <div className="flex md:justify-end">
                <ButtonLink href="/sell" variant="ember" size="lg">
                  {t.merchCta}
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
