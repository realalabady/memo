"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuthedFetch } from "@/lib/auth/auth-provider";
import { useCategories } from "@/lib/data/hooks";
import { deleteCategory, saveCategory, uploadImage } from "@/lib/data/mutations";
import type { Category } from "@/lib/types";
import { slugify } from "@/lib/utils";

export default function AdminCategories() {
  const t = useT().admin;
  const common = useT().common;
  const lang = useLocale();
  const { data: categories } = useCategories();
  const authedFetch = useAuthedFetch();
  const [editing, setEditing] = useState<Category | null>(null);
  const [image, setImage] = useState<string | undefined>();

  function startEdit(c: Category | null) {
    setEditing(c);
    setImage(undefined); // never carry an uploaded image over to another category
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name")).trim();
    const nameAr = String(f.get("nameAr") ?? "").trim();
    const slug = editing?.slug ?? (slugify(name) || slugify(nameAr) || `c-${Date.now().toString(36)}`);
    const id = editing?.id ?? slug;
    if (!editing && categories.some((c) => c.id === id)) {
      return toast.error(fmt(t.categoryExists, { name }));
    }
    try {
      await saveCategory({
        id,
        name,
        nameAr,
        slug,
        blurb: String(f.get("blurb") ?? "").trim(),
        blurbAr: String(f.get("blurbAr") ?? "").trim(),
        image: image ?? editing?.image ?? "",
        order: Number(f.get("order")) || categories.length + 1,
      });
      await authedFetch("/api/revalidate", { method: "POST" });
      toast(editing ? t.categoryUpdated : t.categoryAdded);
      startEdit(null);
      form.reset();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(c: Category) {
    if (!confirm(fmt(t.confirmDeleteCategory, { name: localized(c, "name", lang) }))) return;
    try {
      await deleteCategory(c.id);
      await authedFetch("/api/revalidate", { method: "POST" });
      toast(t.categoryDeleted);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={fmt(t.categoriesCount, { n: categories.length })} title={<>{t.aislesTitle} <span className="italic">{t.aislesEm}</span></>} />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2">
          {categories.map((c) => (
            <div key={c.id} className="group rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
              <div className="relative h-44 overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-sand">
                {c.image && <Image src={c.image} alt="" fill sizes="400px" className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-paper">
                  <div>
                    <p className="font-display text-2xl italic">{localized(c, "name", lang)}</p>
                    <p className="text-[11px] text-paper/70">/{c.slug} · {fmt(t.order, { n: c.order })}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <button onClick={() => startEdit(c)} className="rounded-full bg-paper px-3 py-1 text-xs text-ink">{common.edit}</button>
                    <button onClick={() => remove(c)} className="rounded-full bg-ink/60 px-3 py-1 text-xs">{common.delete}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Panel title={editing ? fmt(t.editCategory, { name: localized(editing, "name", lang) }) : t.newCategory}>
          <form key={editing?.id ?? "new"} onSubmit={submit} className="space-y-4 p-5">
            <Field label={t.name} name="name" dir="ltr" required maxLength={60} defaultValue={editing?.name} />
            <Field label={t.nameAr} name="nameAr" dir="rtl" maxLength={60} defaultValue={editing?.nameAr} />
            <Field label={t.blurb} name="blurb" dir="ltr" defaultValue={editing?.blurb} />
            <Field label={t.blurbAr} name="blurbAr" dir="rtl" defaultValue={editing?.blurbAr} />
            <Field label={t.sortOrder} name="order" type="number" dir="ltr" defaultValue={editing?.order} />
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
            <Button type="submit" className="w-full justify-between">{editing ? common.save : t.addCategory}</Button>
            {editing && (
              <button type="button" onClick={() => startEdit(null)} className="w-full text-center text-xs text-muted">{common.cancel}</button>
            )}
          </form>
        </Panel>
      </div>
    </>
  );
}
