import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryPills, GridSkeleton, ListingHeader } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { getCategories, getCategoryBySlug, getProducts } from "@/lib/server/catalog";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

async function CategoryContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([getCategoryBySlug(slug), getCategories()]);
  if (!category) notFound();
  const products = await getProducts({ categoryId: category.id });
  return (
    <>
      <ListingHeader eyebrow={`${products.length} pieces`} title={<span className="italic">{category.name}</span>} intro={category.blurb} />
      <CategoryPills categories={categories} active={category.id} />
      <ProductGrid products={products} />
    </>
  );
}

export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
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
