"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAllProducts, useCategories } from "@/lib/data/hooks";
import { createCategory, deleteCategory, reorderCategories, updateCategory, uploadImage } from "@/lib/data/mutations";
import type { Category } from "@/lib/types";

const arrow = "flex size-8 items-center justify-center rounded-full bg-paper/90 text-ink transition hover:bg-paper disabled:opacity-30";

export default function AdminCategories() {
  const t = useT().admin;
  const common = useT().common;
  const lang = useLocale();
  const { data: categories } = useCategories();
  const { data: products } = useAllProducts();
  const [editing, setEditing] = useState<Category | null>(null);
  const [image, setImage] = useState<string | undefined>();
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const countIn = (id: string) => products.filter((p) => p.categoryId === id).length;

  function startEdit(c: Category | null) {
    setEditing(c);
    setImage(undefined); // never carry an uploaded image over to another category
    setMoveTo("");
  }

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast(msg);
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const fields = {
      name: String(f.get("name")).trim(),
      nameAr: String(f.get("nameAr") ?? "").trim(),
      blurb: String(f.get("blurb") ?? "").trim(),
      blurbAr: String(f.get("blurbAr") ?? "").trim(),
      image: image ?? editing?.image ?? "",
    };
    const ok = await run(() => (editing ? updateCategory(editing.id, fields) : createCategory(fields)), editing ? t.categoryUpdated : t.categoryAdded);
    if (ok) {
      startEdit(null);
      form.reset();
    }
  }

  async function remove(c: Category) {
    const n = countIn(c.id);
    if (!confirm(fmt(t.confirmDeleteCategory, { name: localized(c, "name", lang) }))) return;
    const ok = await run(() => deleteCategory(c.id, n ? moveTo : undefined), n ? fmt(t.categoryMoved, { n }) : t.categoryDeleted);
    if (ok) startEdit(null);
  }

  function shift(i: number, by: -1 | 1) {
    const ids = categories.map((c) => c.id);
    const j = i + by;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderCategories(ids), t.orderSaved);
  }

  const inEditing = editing ? countIn(editing.id) : 0;

  return (
    <>
      <PageHeader eyebrow={fmt(t.categoriesCount, { n: categories.length })} title={<>{t.aislesTitle} <span className="italic">{t.aislesEm}</span></>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ol className="grid gap-3 sm:grid-cols-2 xl:col-span-2">
          {categories.map((c, i) => (
            <li key={c.id} className="rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
              <div className="relative h-44 overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-sand">
                {c.image && <Image src={c.image} alt="" fill sizes="400px" className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 to-transparent" />
                <div className="absolute end-3 top-3 flex gap-1">
                  <button aria-label={t.moveUp} disabled={busy || i === 0} onClick={() => shift(i, -1)} className={arrow}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button aria-label={t.moveDown} disabled={busy || i === categories.length - 1} onClick={() => shift(i, 1)} className={arrow}>
                    <ArrowDown className="size-4" />
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-paper">
                  <div className="min-w-0">
                    <p className="font-display truncate text-2xl italic">{localized(c, "name", lang)}</p>
                    <p className="truncate text-[11px] text-paper/70">
                      {i + 1} · /{c.slug} · {fmt(t.productsInCategory, { n: countIn(c.id) })}
                    </p>
                  </div>
                  <button onClick={() => startEdit(c)} className="shrink-0 rounded-full bg-paper px-3 py-1 text-xs text-ink">{common.edit}</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="space-y-4">
          <Panel title={editing ? fmt(t.editCategory, { name: localized(editing, "name", lang) }) : t.newCategory}>
            <form key={editing?.id ?? "new"} onSubmit={submit} className="space-y-4 p-5">
              <Field label={t.name} name="name" dir="ltr" required maxLength={60} defaultValue={editing?.name} />
              <Field label={t.nameAr} name="nameAr" dir="rtl" maxLength={60} defaultValue={editing?.nameAr} />
              <Field label={t.blurb} name="blurb" dir="ltr" maxLength={160} defaultValue={editing?.blurb} />
              <Field label={t.blurbAr} name="blurbAr" dir="rtl" maxLength={160} defaultValue={editing?.blurbAr} />
              <label className="block cursor-pointer rounded-2xl border border-dashed border-ink/15 p-4 text-center text-sm text-muted hover:bg-cream">
                {image || editing?.image ? t.imageReady : t.uploadCover}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setImage(await uploadImage("categories", file));
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              </label>
              <Button type="submit" disabled={busy} className="w-full justify-between">{editing ? common.save : t.addCategory}</Button>
              {editing && (
                <button type="button" onClick={() => startEdit(null)} className="w-full text-center text-xs text-muted">{common.cancel}</button>
              )}
            </form>
          </Panel>
          {editing && (
            <Panel title={t.deleteCategory}>
              <div className="space-y-3 p-5">
                <p className="text-[13px] text-muted">{fmt(t.productsInCategory, { n: inEditing })}</p>
                {inEditing > 0 && (
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{t.moveProductsTo}</span>
                    <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-11 w-full rounded-2xl bg-cream px-3 outline-none">
                      <option value="">{t.pickCategory}</option>
                      {categories
                        .filter((c) => c.id !== editing.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>{localized(c, "name", lang)}</option>
                        ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={busy || (inEditing > 0 && !moveTo)}
                  onClick={() => remove(editing)}
                  className="w-full rounded-full px-4 py-2.5 text-sm text-ember ring-1 ring-ember/30 transition hover:bg-ember-soft disabled:opacity-40"
                >
                  {t.deleteCategory}
                </button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
