import type { Metadata } from "next";
import { CategoryPills, ListingHeader } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { getCategories, getProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Shop" };

export default async function ShopPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <ListingHeader
          eyebrow={`${products.length} pieces`}
          title={
            <>
              The whole <span className="italic">shelf.</span>
            </>
          }
          intro="Everything from every store on memo — and every item splits into four with Tabby or Tamara."
        />
        <CategoryPills categories={categories} />
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
