import type { Metadata } from "next";
import { CategoryPills, ListingHeader } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { fmt } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { getCategories, getProducts } from "@/lib/server/catalog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).listing.shopMeta };
}

export default async function ShopPage() {
  const [categories, products, dict] = await Promise.all([getCategories(), getProducts(), getDictionary()]);
  const t = dict.listing;
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <ListingHeader
          eyebrow={fmt(t.pieces, { n: products.length })}
          title={
            <>
              {t.shopTitle} <span className="italic">{t.shopEm}</span>
            </>
          }
          intro={t.shopIntro}
        />
        <CategoryPills categories={categories} />
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
