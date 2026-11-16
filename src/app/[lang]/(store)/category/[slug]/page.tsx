import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryPills, GridSkeleton, ListingHeader } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { localized } from "@/i18n/config";
import { fmt } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getCategories, getCategoryBySlug, getProducts, staticParamsOrPlaceholder } from "@/lib/server/catalog";

export async function generateStaticParams() {
  const categories = await getCategories();
  return staticParamsOrPlaceholder("slug", categories.map((c) => c.slug));
}

async function CategoryContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, categories, dict, lang] = await Promise.all([
    getCategoryBySlug(decodeURIComponent(slug)),
    getCategories(),
    getDictionary(),
    getLocale(),
  ]);
  if (!category) notFound();
  const products = await getProducts({ categoryId: category.id });
  return (
    <>
      <ListingHeader
        eyebrow={fmt(dict.listing.pieces, { n: products.length })}
        title={<span className="italic">{localized(category, "name", lang)}</span>}
        intro={localized(category, "blurb", lang)}
      />
      <CategoryPills categories={categories} active={category.id} />
      <ProductGrid products={products} />
    </>
  );
}

export default function CategoryPage({ params }: PageProps<"/[lang]/category/[slug]">) {
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<GridSkeleton />}>
          <CategoryContent params={params} />
        </Suspense>
      </div>
    </section>
  );
}
