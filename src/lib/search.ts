import type { Product } from "./types";

/**
 * Storefront search over the cached catalog (in memory, on the server).
 * Good for a catalog of a few thousand products with no extra infrastructure;
 * swap `searchProducts` for Algolia/Typesense when the catalog outgrows it.
 */
export const SORTS = ["new", "price_asc", "price_desc", "rating"] as const;
export type Sort = (typeof SORTS)[number];
export const PAGE_SIZE = 24;

export interface ShopQuery {
  q: string;
  category: string;
  store: string;
  min: number | null;
  max: number | null;
  inStock: boolean;
  sort: Sort;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string) => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Reads and sanitises ?q=&category=&store=&min=&max=&stock=1&sort=&page= */
export function parseShopQuery(params: RawParams): ShopQuery {
  const sort = one(params.sort) as Sort;
  return {
    q: one(params.q).trim().slice(0, 80),
    category: one(params.category),
    store: one(params.store),
    min: num(one(params.min)),
    max: num(one(params.max)),
    inStock: one(params.stock) === "1",
    sort: SORTS.includes(sort) ? sort : "new",
    page: Math.max(1, Math.floor(Number(one(params.page)) || 1)),
  };
}

/** Back to a query string (defaults omitted), with overrides — used by pagination and chips. */
export function shopQueryString(q: ShopQuery, override: Partial<ShopQuery> = {}) {
  const v = { ...q, ...override };
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.category) p.set("category", v.category);
  if (v.store) p.set("store", v.store);
  if (v.min !== null) p.set("min", String(v.min));
  if (v.max !== null) p.set("max", String(v.max));
  if (v.inStock) p.set("stock", "1");
  if (v.sort !== "new") p.set("sort", v.sort);
  if (v.page > 1) p.set("page", String(v.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Lowercase, strip Latin accents and Arabic diacritics, and unify Arabic letter variants. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function haystack(p: Product) {
  return normalize([p.title, p.titleAr, p.merchantName, p.description, p.descriptionAr].filter(Boolean).join(" "));
}

export function searchProducts(products: Product[], q: ShopQuery) {
  const words = normalize(q.q).split(" ").filter(Boolean);
  const matches = products.filter((p) => {
    if (q.category && p.categoryId !== q.category) return false;
    if (q.store && p.merchantId !== q.store) return false;
    if (q.min !== null && p.price < q.min) return false;
    if (q.max !== null && p.price > q.max) return false;
    if (q.inStock && p.stock <= 0) return false;
    if (!words.length) return true;
    // Match from the start of a word ("oud" finds "Oud Noir", not "Cloud"); Arabic words also match without "ال".
    const tokens = haystack(p).split(" ");
    return words.every((w) => tokens.some((tok) => tok.startsWith(w) || (tok.startsWith("ال") && tok.slice(2).startsWith(w))));
  });

  const sorted = [...matches].sort((a, b) => {
    if (q.sort === "price_asc") return a.price - b.price;
    if (q.sort === "price_desc") return b.price - a.price;
    if (q.sort === "rating") return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
    return b.createdAt - a.createdAt;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(q.page, pages);
  return {
    total: sorted.length,
    pages,
    page,
    items: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}
