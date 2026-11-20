"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GridSkeleton } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { Reveal } from "@/components/ui/motion";
import { Eyebrow } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { useWishlist } from "@/lib/store/wishlist";
import type { Product } from "@/lib/types";

export default function WishlistPage() {
  const t = useT().wishlist;
  const account = useT().account;
  const { ids, ready } = useWishlist();
  const [products, setProducts] = useState<Product[] | null>(null);
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const list = key
        ? await fetch(`/api/products?ids=${encodeURIComponent(key)}`)
            .then((r) => r.json() as Promise<{ products: Product[] }>)
            .then((b) => b.products)
            .catch(() => [])
        : [];
      if (!cancelled) setProducts(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, ready]);

  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-12">
          <Link href="/account">
            <Eyebrow>{account.eyebrow}</Eyebrow>
          </Link>
          <h1 className="font-display mt-6 text-6xl leading-[0.92] md:text-8xl">
            {t.title} <span className="italic">{t.titleEm}</span>
          </h1>
        </Reveal>
        {products === null ? (
          <GridSkeleton />
        ) : products.length === 0 ? (
          <div className="rounded-[2rem] bg-cream/60 px-6 py-24 text-center">
            <p className="font-display text-3xl italic">{t.empty}</p>
            <p className="mt-2 text-sm text-muted">{t.emptyBody}</p>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </section>
  );
}
