import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GridSkeleton } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { Reveal } from "@/components/ui/motion";
import { Eyebrow } from "@/components/ui/primitives";
import { getMerchantBySlug, getProducts } from "@/lib/server/catalog";

async function StoreContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const merchant = await getMerchantBySlug(slug);
  if (!merchant) notFound();
  const products = await getProducts({ merchantId: merchant.id });
  return (
    <>
      <Reveal className="mb-16 grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-8">
          <div className="flex items-center gap-4">
            <div className="relative size-16 overflow-hidden rounded-full bg-sand ring-4 ring-paper shadow-[var(--shadow-float)]">
              {merchant.logoUrl && <Image src={merchant.logoUrl} alt="" fill sizes="64px" className="object-cover" />}
            </div>
            <Eyebrow>{merchant.city ?? "Saudi Arabia"}</Eyebrow>
          </div>
          <h1 className="font-display mt-8 text-6xl leading-[0.92] md:text-8xl">{merchant.storeName}</h1>
          {merchant.tagline && <p className="font-display mt-3 text-3xl italic text-ember">{merchant.tagline}</p>}
        </div>
        <p className="text-ink/60 md:col-span-4">{merchant.bio}</p>
      </Reveal>
      <ProductGrid products={products} />
    </>
  );
}

export default function StorePage({ params }: PageProps<"/store/[slug]">) {
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<GridSkeleton />}>
          <StoreContent params={params} />
        </Suspense>
      </div>
    </section>
  );
}
