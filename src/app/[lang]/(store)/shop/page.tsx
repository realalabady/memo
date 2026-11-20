import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GridSkeleton, ListingHeader } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { ShopFilters } from "@/components/store/shop-filters";
import { fmt } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { parseShopQuery, searchProducts, shopQueryString } from "@/lib/search";
import { getCategories, getMerchants, getProducts } from "@/lib/server/catalog";
import { alternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [dict, lang] = await Promise.all([getDictionary(), getLocale()]);
  return { title: dict.listing.shopMeta, alternates: alternates(lang, "/shop") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Search, filters, sorting and paging run on the server over the cached catalog; the URL holds the state. */
async function Results({ searchParams }: { searchParams: SearchParams }) {
  const [raw, categories, products, merchants, dict] = await Promise.all([
    searchParams,
    getCategories(),
    getProducts(),
    getMerchants(),
    getDictionary(),
  ]);
  const t = dict.shop;
  const query = parseShopQuery(raw);
  const result = searchProducts(products, query);
  const pageLink = (page: number) => `/shop${shopQueryString(query, { page })}`;

  return (
    <>
      <ListingHeader
        eyebrow={query.q ? fmt(t.resultsFor, { n: result.total, q: query.q }) : fmt(dict.listing.pieces, { n: result.total })}
        title={
          <>
            {dict.listing.shopTitle} <span className="italic">{dict.listing.shopEm}</span>
          </>
        }
        intro={dict.listing.shopIntro}
      />
      <ShopFilters
        key={shopQueryString(query, { page: 1 })}
        query={query}
        categories={categories}
        stores={merchants.map((m) => ({ id: m.id, storeName: m.storeName }))}
      />
      {result.total === 0 && products.length > 0 ? (
        <div className="rounded-[2rem] bg-cream/60 px-6 py-24 text-center">
          <p className="font-display text-3xl italic">{t.noResults}</p>
          <p className="mt-2 text-sm text-muted">{t.noResultsBody}</p>
          <Link href="/shop" className="mt-6 inline-block text-sm underline underline-offset-4">
            {t.clear}
          </Link>
        </div>
      ) : (
        <ProductGrid products={result.items} />
      )}
      {result.pages > 1 && (
        <nav aria-label={fmt(t.pageOf, { page: result.page, pages: result.pages })} className="mt-14 flex items-center justify-center gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={pageLink(result.page - 1)} rel="prev" className="rounded-full px-4 py-2 ring-1 ring-ink/10 transition hover:bg-ink/5">
              {t.prev}
            </Link>
          ) : (
            <span className="rounded-full px-4 py-2 text-muted/50 ring-1 ring-ink/5">{t.prev}</span>
          )}
          <span className="tabular-nums text-muted">{fmt(t.pageOf, { page: result.page, pages: result.pages })}</span>
          {result.page < result.pages ? (
            <Link href={pageLink(result.page + 1)} rel="next" className="rounded-full px-4 py-2 ring-1 ring-ink/10 transition hover:bg-ink/5">
              {t.next}
            </Link>
          ) : (
            <span className="rounded-full px-4 py-2 text-muted/50 ring-1 ring-ink/5">{t.next}</span>
          )}
        </nav>
      )}
    </>
  );
}

export default function ShopPage({ searchParams }: PageProps<"/[lang]/shop">) {
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<GridSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}
