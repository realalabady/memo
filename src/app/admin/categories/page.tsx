"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field } from "@/components/ui/primitives";
import { useAuthedFetch } from "@/lib/auth/auth-provider";
import { useCategories } from "@/lib/data/hooks";
import { deleteCategory, saveCategory, uploadImage } from "@/lib/data/mutations";
import type { Category } from "@/lib/types";
import { slugify } from "@/lib/utils";

export default function AdminCategories() {
  const { data: categories } = useCategories();
  const authedFetch = useAuthedFetch();
  const [editing, setEditing] = useState<Category | null>(null);
  const [image, setImage] = useState<string | undefined>();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name"));
    const slug = editing?.slug ?? slugify(name);
    try {
      await saveCategory({
        id: editing?.id ?? slug,
        name,
        slug,
        blurb: String(f.get("blurb")),
        image: image ?? editing?.image ?? "",
        order: Number(f.get("order")) || categories.length + 1,
      });
      await authedFetch("/api/revalidate", { method: "POST" });
      toast(editing ? "Category updated" : "Category added");
      setEditing(null);
      setImage(undefined);
      form.reset();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete ${c.name}? Products keep their category id.`)) return;
    try {
      await deleteCategory(c.id);
      await authedFetch("/api/revalidate", { method: "POST" });
      toast("Category deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={`${categories.length} categories`} title={<>The <span className="italic">aisles</span></>} />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2">
          {categories.map((c) => (
            <div key={c.id} className="group rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06]">
              <div className="relative h-44 overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-sand">
                {c.image && <Image src={c.image} alt="" fill sizes="400px" className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-paper">
                  <div>
                    <p className="font-display text-2xl italic">{c.name}</p>
                    <p className="text-[11px] text-paper/70">/{c.slug} · order {c.order}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => setEditing(c)} className="rounded-full bg-paper px-3 py-1 text-xs text-ink">Edit</button>
                    <button onClick={() => remove(c)} className="rounded-full bg-ink/60 px-3 py-1 text-xs">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Panel title={editing ? `Edit ${editing.name}` : "New category"}>
          <form key={editing?.id ?? "new"} onSubmit={submit} className="space-y-4 p-5">
            <Field label="Name" name="name" required defaultValue={editing?.name} />
            <Field label="Short description" name="blurb" defaultValue={editing?.blurb} />
            <Field label="Sort order" name="order" type="number" defaultValue={editing?.order} />
            <label className="block cursor-pointer rounded-2xl border border-dashed border-ink/15 p-4 text-center text-sm text-muted hover:bg-cream">
              {image || editing?.image ? "Image ready — click to replace" : "Upload cover image"}
              <input
                type="file"
                accept="image/*"
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
            <Button type="submit" className="w-full justify-between">{editing ? "Save" : "Add category"}</Button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)} className="w-full text-center text-xs text-muted">Cancel</button>
            )}
          </form>
        </Panel>
      </div>
    </>
  );
}
