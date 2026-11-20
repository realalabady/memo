"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { localized } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { parseShopQuery, shopQueryString, type ShopQuery } from "@/lib/search";
import type { Category, Merchant } from "@/lib/types";
import { cn } from "@/lib/utils";

const field = "h-11 rounded-full bg-paper px-4 text-sm outline-none ring-1 ring-ink/[0.08] transition focus:ring-ink/30";

/** Search box + filters for /shop. State lives in the URL, so results are shareable and work with back/forward. */
export function ShopFilters({ query, categories, stores }: { query: ShopQuery; categories: Category[]; stores: Pick<Merchant, "id" | "storeName">[] }) {
  const t = useT().shop;
  const lang = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = Boolean(query.q || query.category || query.store || query.min !== null || query.max !== null || query.inStock || query.sort !== "new");

  function apply(form: HTMLFormElement) {
    const f = new FormData(form);
    const next = parseShopQuery(Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])));
    start(() => router.push(`/shop${shopQueryString({ ...next, page: 1 })}`));
  }
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    apply(e.currentTarget);
  };
  // Selects and the checkbox apply immediately; text and price fields apply on Enter / the button.
  const auto = (e: FormEvent<HTMLSelectElement | HTMLInputElement>) => e.currentTarget.form && apply(e.currentTarget.form);

  return (
    <form onSubmit={onSubmit} role="search" className={cn("mb-10 space-y-3 transition-opacity", pending && "opacity-60")}>
      <div className="flex gap-2">
        <label className={cn(field, "flex flex-1 items-center gap-2")}>
          <MagnifyingGlass weight="light" className="size-4 shrink-0 text-muted" />
          <input type="search" name="q" defaultValue={query.q} placeholder={t.searchPlaceholder} aria-label={t.search} maxLength={80} className="w-full bg-transparent outline-none" />
        </label>
        <button type="submit" className="h-11 shrink-0 rounded-full bg-ink px-5 text-sm text-paper transition active:scale-[0.97]">
          {t.search}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select name="category" defaultValue={query.category} onChange={auto} aria-label={t.allCategories} className={field}>
          <option value="">{t.allCategories}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{localized(c, "name", lang)}</option>
          ))}
        </select>
        <select name="store" defaultValue={query.store} onChange={auto} aria-label={t.allStores} className={field}>
          <option value="">{t.allStores}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.storeName}</option>
          ))}
        </select>
        <input name="min" type="number" inputMode="numeric" min={0} dir="ltr" defaultValue={query.min ?? ""} placeholder={t.minPrice} aria-label={t.minPrice} className={cn(field, "w-28")} />
        <input name="max" type="number" inputMode="numeric" min={0} dir="ltr" defaultValue={query.max ?? ""} placeholder={t.maxPrice} aria-label={t.maxPrice} className={cn(field, "w-28")} />
        <label className={cn(field, "flex cursor-pointer items-center gap-2")}>
          <input type="checkbox" name="stock" value="1" defaultChecked={query.inStock} onChange={auto} className="size-4 accent-[var(--color-ink)]" />
          {t.inStock}
        </label>
        <select name="sort" defaultValue={query.sort} onChange={auto} aria-label={t.sort} className={cn(field, "ms-auto")}>
          <option value="new">{t.sortNew}</option>
          <option value="price_asc">{t.sortPriceAsc}</option>
          <option value="price_desc">{t.sortPriceDesc}</option>
          <option value="rating">{t.sortRating}</option>
        </select>
        {active && (
          <Link href="/shop" className="rounded-full px-3 py-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            {t.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
