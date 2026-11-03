import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { demoCategories, demoMerchants, demoProducts } from "@/lib/fixtures";
import type { Category, Merchant, Product } from "@/lib/types";

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
    const snap = await q.get();
    items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Product)
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
  return product.status === "active" ? product : null;
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

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const all = await getCategories();
  return all.find((c) => c.slug === slug) ?? null;
}
