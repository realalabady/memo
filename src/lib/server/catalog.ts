import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { demoCategories, demoMerchants, demoProducts } from "@/lib/fixtures";
import { withLegalDefaults, type LegalPage, type LegalSlug } from "@/lib/legal";
import { DEFAULT_STOREFRONT, withStorefrontDefaults, type Category, type Merchant, type Product, type Review, type StorefrontSettings } from "@/lib/types";

/**
 * Public catalog reads for the storefront. Cached with `use cache` and
 * tagged `catalog` so merchant edits can revalidate them (see /api/revalidate).
 * Falls back to sample data when Firebase Admin isn't configured.
 */

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  if (!isAdminConfigured) return demoCategories;
  const snap = await adminDb().collection("categories").orderBy("order").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
}

export async function getProducts(
  filter: { categoryId?: string; merchantId?: string; limit?: number } = {},
): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  let items: Product[];
  if (!isAdminConfigured) {
    items = demoProducts.filter(
      (p) =>
        (!filter.categoryId || p.categoryId === filter.categoryId) &&
        (!filter.merchantId || p.merchantId === filter.merchantId),
    );
  } else {
    let q = adminDb().collection("products").where("status", "==", "active");
    if (filter.categoryId) q = q.where("categoryId", "==", filter.categoryId);
    if (filter.merchantId) q = q.where("merchantId", "==", filter.merchantId);
    const [snap, approved] = await Promise.all([q.get(), approvedMerchantIds()]);
    // Products of pending/suspended stores stay hidden even if the product itself is active.
    items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Product)
      .filter((p) => approved.has(p.merchantId))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return filter.limit ? items.slice(0, filter.limit) : items;
}

export async function getProduct(id: string): Promise<Product | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  if (!isAdminConfigured) return demoProducts.find((p) => p.id === id) ?? null;
  const doc = await adminDb().collection("products").doc(id).get();
  if (!doc.exists) return null;
  const product = { id: doc.id, ...doc.data() } as Product;
  if (product.status !== "active") return null;
  return (await approvedMerchantIds()).has(product.merchantId) ? product : null;
}

/** Visible reviews of a product, newest first. Hidden ones never reach the page. */
export async function getReviews(productId: string): Promise<Review[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  if (!isAdminConfigured) return [];
  const snap = await adminDb()
    .collection("products")
    .doc(productId)
    .collection("reviews")
    .orderBy("createdAt", "desc")
    .limit(40)
    .get();
  return snap.docs.map((d) => d.data() as Review).filter((r) => !r.hidden);
}

async function approvedMerchantIds() {
  return new Set((await getMerchants()).map((m) => m.id));
}

export async function getMerchants(): Promise<Merchant[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  if (!isAdminConfigured) return demoMerchants;
  const snap = await adminDb().collection("merchants").where("status", "==", "approved").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Merchant);
}

export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const all = await getMerchants();
  return all.find((m) => m.slug === slug) ?? null;
}

/**
 * Cache Components requires generateStaticParams to return at least one param.
 * With an empty catalog we return a placeholder that the page resolves to notFound().
 */
export function staticParamsOrPlaceholder<K extends string>(key: K, values: string[]) {
  const list = values.length ? values : ["__placeholder__"];
  return list.map((v) => ({ [key]: v }) as Record<K, string>);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const all = await getCategories();
  return all.find((c) => c.slug === slug) ?? null;
}

/** Home page layout and copy (settings/storefront), edited at /admin/storefront. */
export async function getStorefront(): Promise<StorefrontSettings> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  if (!isAdminConfigured) return DEFAULT_STOREFRONT;
  const snap = await adminDb().collection("settings").doc("storefront").get();
  return withStorefrontDefaults(snap.data() as Partial<StorefrontSettings> | undefined);
}

/** A legal/policy page (pages/{slug}), falling back to the built-in text. */
export async function getLegalPage(slug: LegalSlug): Promise<LegalPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  if (!isAdminConfigured) return withLegalDefaults(slug);
  const snap = await adminDb().collection("pages").doc(slug).get();
  return withLegalDefaults(slug, snap.data() as Partial<LegalPage> | undefined);
}
