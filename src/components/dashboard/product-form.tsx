"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ImageSquare, X } from "@phosphor-icons/react";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field, SelectField, TextArea } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCategories } from "@/lib/data/hooks";
import { saveProduct, uploadImage } from "@/lib/data/mutations";
import type { Product } from "@/lib/types";

export function ProductForm({ product }: { product?: Product }) {
  const t = useT().merchant.form;
  const lang = useLocale();
  const { user, merchant } = useAuth();
  const router = useRouter();
  const { data: categories } = useCategories();
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      const room = Math.max(0, 8 - images.length);
      const urls = await Promise.all([...files].slice(0, room).map((f) => uploadImage(`products/${user.uid}`, f)));
      setImages((cur) => [...cur, ...urls].slice(0, 8));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !merchant) return;
    if (!images.length) return toast.error(t.needPhoto);
    const f = new FormData(e.currentTarget);
    const compare = Number(f.get("compareAtPrice"));
    setBusy(true);
    try {
      await saveProduct(product?.id ?? null, {
        title: String(f.get("title")).trim(),
        titleAr: String(f.get("titleAr") ?? "").trim(),
        description: String(f.get("description")).trim(),
        descriptionAr: String(f.get("descriptionAr") ?? "").trim(),
        price: Number(f.get("price")),
        compareAtPrice: compare > 0 ? compare : null,
        images,
        categoryId: String(f.get("categoryId")),
        stock: Number(f.get("stock")),
        status: f.get("status") === "draft" ? "draft" : "active",
      });
      toast(product ? t.updated : t.published);
      router.push("/merchant/products");
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-3">
      <Panel className="xl:col-span-2" title={t.details}>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label={t.title} name="title" dir="ltr" required maxLength={140} defaultValue={product?.title} />
          <Field label={t.titleAr} name="titleAr" dir="rtl" maxLength={140} defaultValue={product?.titleAr} />
          <TextArea label={t.description} name="description" dir="ltr" required maxLength={5000} defaultValue={product?.description} />
          <TextArea label={t.descriptionAr} name="descriptionAr" dir="rtl" maxLength={5000} defaultValue={product?.descriptionAr} />
          <Field label={t.price} name="price" type="number" dir="ltr" min={1} step="0.01" required defaultValue={product?.price} />
          <Field label={t.compareAt} name="compareAtPrice" type="number" dir="ltr" min={0} step="0.01" defaultValue={product?.compareAtPrice} />
          <Field label={t.stock} name="stock" type="number" dir="ltr" min={0} required defaultValue={product?.stock ?? 10} />
          <SelectField label={t.category} name="categoryId" required defaultValue={product?.categoryId}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{localized(c, "name", lang)}</option>
            ))}
          </SelectField>
          <SelectField className="sm:col-span-2" label={t.visibility} name="status" defaultValue={product?.status === "draft" ? "draft" : "active"}>
            <option value="active">{t.active}</option>
            <option value="draft">{t.draft}</option>
          </SelectField>
        </div>
      </Panel>
      <Panel title={t.photos}>
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              <div key={src} className="group relative aspect-square overflow-hidden rounded-2xl bg-sand">
                <Image src={src} alt="" fill sizes="120px" className="object-cover" />
                {i === 0 && <span className="absolute start-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[9px] text-paper">{t.cover}</span>}
                <button type="button" aria-label={t.removeImage} onClick={() => setImages((cur) => cur.filter((x) => x !== src))} className="absolute end-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-paper/90 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {images.length < 8 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-ink/15 text-[11px] text-muted transition hover:bg-cream">
                <ImageSquare weight="light" className="size-6" />
                {uploading ? t.uploading : t.add}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              </label>
            )}
          </div>
          <p className="text-[11px] text-muted">{t.photoHint}</p>
          <Button type="submit" disabled={busy || uploading || !merchant} className="w-full justify-between">
            {product ? t.save : t.publish}
          </Button>
        </div>
      </Panel>
    </form>
  );
}
