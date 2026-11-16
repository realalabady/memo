import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Package, ShieldCheck, Storefront } from "@phosphor-icons/react/dist/ssr";
import { AddToCart } from "@/components/store/add-to-cart";
import { Gallery } from "@/components/store/gallery";
import { InstallmentPlan } from "@/components/store/installments";
import { ProductGrid } from "@/components/store/product-card";
import { Reveal } from "@/components/ui/motion";
import { Eyebrow } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { fmt } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getMerchants, getProduct, getProducts, staticParamsOrPlaceholder } from "@/lib/server/catalog";
import { formatSAR } from "@/lib/utils";

export async function generateStaticParams() {
  const products = await getProducts();
  return staticParamsOrPlaceholder("id", products.map((p) => p.id));
}

async function ProductContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, dict, lang] = await Promise.all([getProduct(id), getDictionary(), getLocale()]);
  if (!product) notFound();
  const [merchants, related] = await Promise.all([getMerchants(), getProducts({ categoryId: product.categoryId, limit: 5 })]);
  const merchant = merchants.find((m) => m.id === product.merchantId);
  const t = dict.product;
  const title = localized(product, "title", lang);
  const others = related.filter((p) => p.id !== product.id);

  return (
    <>
      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        <Reveal y={24}>
          <Gallery images={product.images} title={title} />
        </Reveal>
        <Reveal delay={0.1} className="md:sticky md:top-32 md:self-start">
          <Link href={`/store/${product.merchantSlug}`}>
            <Eyebrow>{product.merchantName}</Eyebrow>
          </Link>
          <h1 className="font-display mt-6 text-5xl leading-[0.95] md:text-6xl">{title}</h1>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-2xl tabular-nums">{formatSAR(product.price, { lang })}</span>
            {product.compareAtPrice && (
              <span className="text-muted line-through tabular-nums">{formatSAR(product.compareAtPrice, { lang })}</span>
            )}
          </div>
          <p className="mt-6 max-w-lg whitespace-pre-line leading-relaxed text-ink/65">{localized(product, "description", lang)}</p>
          <div className="mt-8 space-y-4">
            <InstallmentPlan amount={product.price} />
            <AddToCart product={product} />
          </div>
          <ul className="mt-8 grid grid-cols-3 gap-2 text-[12px] text-ink/60">
            {[
              { i: Package, t: product.stock > 0 ? fmt(t.inStock, { n: product.stock }) : t.soldOut },
              { i: ShieldCheck, t: t.secure },
              { i: Storefront, t: merchant?.city ? fmt(t.shipsFrom, { city: merchant.city }) : t.shipsFromStore },
            ].map(({ i: Icon, t: label }) => (
              <li key={label} className="flex flex-col items-start gap-2 rounded-2xl bg-cream/60 p-3">
                <Icon weight="light" className="size-5 text-ink" />
                {label}
              </li>
            ))}
          </ul>
          {merchant && (
            <Link href={`/store/${merchant.slug}`} className="group mt-6 flex items-center gap-3 rounded-3xl p-3 ring-1 ring-ink/[0.06] transition hover:bg-cream/60">
              <div className="relative size-11 overflow-hidden rounded-full bg-sand">
                {merchant.logoUrl && <Image src={merchant.logoUrl} alt="" fill sizes="44px" className="object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{merchant.storeName}</p>
                <p className="text-xs text-muted">{localized(merchant, "tagline", lang)}</p>
              </div>
              <span className="pe-2 text-xs text-muted group-hover:text-ink">{t.visit}</span>
            </Link>
          )}
        </Reveal>
      </div>

      {others.length > 0 && (
        <div className="mt-32">
          <h2 className="font-display mb-10 text-4xl md:text-5xl">
            {t.alsoLike} <span className="italic">{t.alsoLikeEm}</span>
          </h2>
          <ProductGrid products={others.slice(0, 4)} />
        </div>
      )}
    </>
  );
}

export default function ProductPage({ params }: PageProps<"/[lang]/product/[id]">) {
  return (
    <section className="px-4 pb-12 pt-32 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<div className="aspect-[2/1] animate-pulse rounded-[2rem] bg-cream" />}>
          <ProductContent params={params} />
        </Suspense>
      </div>
    </section>
  );
}
