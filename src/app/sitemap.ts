import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/i18n/config";
import { LEGAL_SLUGS } from "@/lib/legal";
import { getCategories, getLegalPage, getMerchants, getProducts } from "@/lib/server/catalog";
import { siteUrl } from "@/lib/seo";

/** Every public page in both languages, with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [categories, merchants, products, legal] = await Promise.all([
    getCategories(),
    getMerchants(),
    getProducts(),
    Promise.all(LEGAL_SLUGS.map((s) => getLegalPage(s))),
  ]);

  const entry = (path: string, opts: { lastModified?: number; priority?: number; changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"] } = {}) => {
    const p = path === "/" ? "" : path;
    const languages = { ...Object.fromEntries(locales.map((l) => [l, `${base}/${l}${p}`])), "x-default": `${base}/${defaultLocale}${p}` };
    return locales.map((l) => ({
      url: `${base}/${l}${p}`,
      lastModified: opts.lastModified ? new Date(opts.lastModified) : undefined,
      changeFrequency: opts.changeFrequency,
      priority: opts.priority,
      alternates: { languages },
    }));
  };

  return [
    ...entry("/", { priority: 1, changeFrequency: "daily" }),
    ...entry("/shop", { priority: 0.9, changeFrequency: "daily" }),
    ...entry("/sell", { priority: 0.5, changeFrequency: "monthly" }),
    ...categories.flatMap((c) => entry(`/category/${c.slug}`, { priority: 0.8, changeFrequency: "daily" })),
    ...merchants.flatMap((m) => entry(`/store/${m.slug}`, { priority: 0.7, changeFrequency: "weekly" })),
    ...products.flatMap((p) => entry(`/product/${p.id}`, { lastModified: p.updatedAt ?? p.createdAt, priority: 0.8, changeFrequency: "weekly" })),
    ...legal.flatMap((page) => entry(`/legal/${page.slug}`, { lastModified: page.updatedAt || undefined, priority: 0.3, changeFrequency: "yearly" })),
  ];
}
