"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeSlash, MagnifyingGlass, X } from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAllProducts, useCategories, useStorefront } from "@/lib/data/hooks";
import { saveStorefront, uploadImage } from "@/lib/data/mutations";
import { normalize } from "@/lib/search";
import type { Product, StorefrontSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

function move<T>(list: T[], i: number, by: -1 | 1) {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const iconBtn = "flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-30";

/** Ordered pick-list of products: search to add, arrows to reorder. */
function ProductPicker({ products, value, onChange, max }: { products: Product[]; value: string[]; onChange: (ids: string[]) => void; max: number }) {
  const t = useT().cms;
  const adminT = useT().admin;
  const { money, lang } = useFormat();
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const picked = value.map((id) => byId.get(id)).filter((p) => p !== undefined);
  const results = useMemo(() => {
    const s = normalize(q);
    if (!s) return [];
    return products
      .filter((p) => p.status === "active" && !value.includes(p.id))
      .filter((p) => normalize([p.title, p.titleAr ?? "", p.merchantName].join(" ")).includes(s))
      .slice(0, 6);
  }, [q, products, value]);
  const full = value.length >= max;

  return (
    <div className="space-y-3">
      {picked.length ? (
        <ol className="space-y-1.5">
          {picked.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-cream/60 p-2">
              <span className="w-5 text-center font-mono text-[11px] text-muted">{i + 1}</span>
              <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-sand">
                {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{localized(p, "title", lang)}</span>
                <span className="block truncate text-[11px] text-muted">{p.merchantName} · {money(p.price)}</span>
              </span>
              <button type="button" aria-label={adminT.moveUp} disabled={i === 0} onClick={() => onChange(move(value, value.indexOf(p.id), -1))} className={iconBtn}>
                <ArrowUp className="size-4" />
              </button>
              <button type="button" aria-label={adminT.moveDown} disabled={i === picked.length - 1} onClick={() => onChange(move(value, value.indexOf(p.id), 1))} className={iconBtn}>
                <ArrowDown className="size-4" />
              </button>
              <button type="button" aria-label={t.remove} onClick={() => onChange(value.filter((id) => id !== p.id))} className={iconBtn}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-3 text-[13px] text-muted">{t.none}</p>
      )}
      <label className={cn("flex h-11 items-center gap-2 rounded-full bg-paper px-4 ring-1 ring-ink/[0.08]", full && "opacity-50")}>
        <MagnifyingGlass weight="light" className="size-4 shrink-0 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} disabled={full} placeholder={full ? fmt(t.limit, { n: max }) : t.search} className="w-full min-w-0 bg-transparent text-sm outline-none" />
      </label>
      {results.length > 0 && (
        <ul className="divide-y divide-ink/[0.05] rounded-2xl ring-1 ring-ink/[0.06]">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, p.id]);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 p-2 text-start hover:bg-cream/60"
              >
                <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-sand">
                  {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="36px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{localized(p, "title", lang)}</span>
                <span className="text-[11px] text-muted">{t.add}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Draft = Omit<StorefrontSettings, "updatedAt">;

function Editor({ initial }: { initial: Draft }) {
  const t = useT().cms;
  const admin = useT().admin;
  const { lang } = useFormat();
  const { data: products } = useAllProducts();
  const { data: categories } = useCategories();
  const [sf, setSf] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setSf((s) => ({ ...s, [key]: value }));
  const hero = (key: keyof Draft["hero"], value: string) => setSf((s) => ({ ...s, hero: { ...s.hero, [key]: value } }));
  const banner = <K extends keyof Draft["banner"]>(key: K, value: Draft["banner"][K]) => setSf((s) => ({ ...s, banner: { ...s.banner, [key]: value } }));

  async function publish() {
    setSaving(true);
    try {
      await saveStorefront(sf);
      toast(t.saved);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const heroLines = [
    ["l1", "l1Ar", t.l1],
    ["l2", "l2Ar", t.l2],
    ["l3", "l3Ar", t.l3],
    ["body", "bodyAr", t.body],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={<>{t.title} <span className="italic">{t.titleEm}</span></>}
        actions={
          <>
            <Link href="/" target="_blank" className="rounded-full px-4 py-2.5 text-sm text-muted ring-1 ring-ink/10 hover:text-ink">{t.preview}</Link>
            <Button onClick={publish} disabled={saving}>{t.save}</Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Panel title={t.hero}>
            <div className="space-y-4 p-5">
              <p className="text-[13px] text-muted">{t.heroHint}</p>
              {heroLines.map(([en, ar, label]) => (
                <div key={en} className="grid gap-3 sm:grid-cols-2">
                  <Field label={`${label} · ${t.english}`} dir="ltr" maxLength={en === "body" ? 240 : 40} value={sf.hero[en]} onChange={(e) => hero(en, e.target.value)} />
                  <Field label={`${label} · ${t.arabic}`} dir="rtl" maxLength={ar === "bodyAr" ? 240 : 40} value={sf.hero[ar]} onChange={(e) => hero(ar, e.target.value)} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={t.heroProducts}>
            <div className="space-y-3 p-5">
              <p className="text-[13px] text-muted">{t.heroProductsHint}</p>
              <ProductPicker products={products} value={sf.heroProductIds} onChange={(ids) => set("heroProductIds", ids)} max={3} />
            </div>
          </Panel>
          <Panel title={t.featuredProducts}>
            <div className="space-y-3 p-5">
              <p className="text-[13px] text-muted">{t.featuredProductsHint}</p>
              <ProductPicker products={products} value={sf.featuredProductIds} onChange={(ids) => set("featuredProductIds", ids)} max={12} />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={t.sections}>
            <div className="p-5">
              <p className="mb-3 text-[13px] text-muted">{t.sectionsHint}</p>
              <ol className="space-y-1.5">
                {sf.sections.map((sec, i) => (
                  <li key={sec.id} className={cn("flex items-center gap-2 rounded-2xl p-2 ps-4", sec.visible ? "bg-cream/60" : "bg-ink/[0.03] text-muted")}>
                    <span className="min-w-0 flex-1 truncate text-sm">{t.sectionNames[sec.id]}</span>
                    <button
                      type="button"
                      aria-pressed={sec.visible}
                      onClick={() => set("sections", sf.sections.map((x) => (x.id === sec.id ? { ...x, visible: !x.visible } : x)))}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 ring-ink/10 hover:bg-paper"
                    >
                      {sec.visible ? <Eye className="size-3.5" /> : <EyeSlash className="size-3.5" />}
                      {sec.visible ? t.visible : t.hidden}
                    </button>
                    <button type="button" aria-label={admin.moveUp} disabled={i === 0} onClick={() => set("sections", move(sf.sections, i, -1))} className={iconBtn}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" aria-label={admin.moveDown} disabled={i === sf.sections.length - 1} onClick={() => set("sections", move(sf.sections, i, 1))} className={iconBtn}>
                      <ArrowDown className="size-4" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>

          <Panel title={t.banner}>
            <div className="space-y-4 p-5">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={sf.banner.enabled} onChange={(e) => banner("enabled", e.target.checked)} className="size-4 accent-ink" />
                {t.bannerOn}
              </label>
              <label className="block cursor-pointer">
                <span className="relative block aspect-[3/1] overflow-hidden rounded-2xl bg-sand ring-1 ring-ink/10">
                  {sf.banner.image && <Image src={sf.banner.image} alt="" fill sizes="600px" className="object-cover" />}
                  <span className="absolute bottom-2 end-2 rounded-full bg-paper/90 px-3 py-1 text-xs">{sf.banner.image ? t.bannerReplace : t.bannerImage}</span>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      banner("image", await uploadImage("storefront", file));
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`${t.bannerTitle} · ${t.english}`} dir="ltr" maxLength={80} value={sf.banner.title} onChange={(e) => banner("title", e.target.value)} />
                <Field label={`${t.bannerTitle} · ${t.arabic}`} dir="rtl" maxLength={80} value={sf.banner.titleAr} onChange={(e) => banner("titleAr", e.target.value)} />
                <Field label={`${t.bannerSubtitle} · ${t.english}`} dir="ltr" maxLength={160} value={sf.banner.subtitle} onChange={(e) => banner("subtitle", e.target.value)} />
                <Field label={`${t.bannerSubtitle} · ${t.arabic}`} dir="rtl" maxLength={160} value={sf.banner.subtitleAr} onChange={(e) => banner("subtitleAr", e.target.value)} />
              </div>
              <Field label={t.bannerLink} dir="ltr" maxLength={300} value={sf.banner.link} onChange={(e) => banner("link", e.target.value)} />
            </div>
          </Panel>

          <Panel title={t.featuredCategories}>
            <div className="p-5">
              <p className="mb-3 text-[13px] text-muted">{t.featuredCategoriesHint}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {categories.map((c) => {
                  const on = sf.featuredCategoryIds.includes(c.id);
                  return (
                    <label key={c.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-sm", on ? "bg-cream" : "hover:bg-cream/50")}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          set(
                            "featuredCategoryIds",
                            // keep the categories' own sort order
                            categories.map((x) => x.id).filter((id) => (id === c.id ? !on : sf.featuredCategoryIds.includes(id))),
                          )
                        }
                        className="size-4 accent-ink"
                      />
                      {localized(c, "name", lang)}
                    </label>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function AdminStorefront() {
  const { data, loading } = useStorefront();
  if (loading) return <div className="h-96 animate-pulse rounded-[1.75rem] bg-cream" />;
  const { updatedAt, ...initial } = data;
  // Keyed so a save from another tab reloads the form.
  return <Editor key={updatedAt} initial={initial} />;
}
