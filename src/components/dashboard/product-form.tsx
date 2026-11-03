"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ImageSquare, X } from "@phosphor-icons/react";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field, SelectField, TextArea } from "@/components/ui/primitives";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { useCategories } from "@/lib/data/hooks";
import { saveProduct, uploadImage } from "@/lib/data/mutations";
import type { Product } from "@/lib/types";

export function ProductForm({ product }: { product?: Product }) {
  const { user, merchant } = useAuth();
  const authedFetch = useAuthedFetch();
  const router = useRouter();
  const { data: categories } = useCategories();
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      const urls = await Promise.all([...files].slice(0, 6).map((f) => uploadImage(`products/${user.uid}`, f)));
      setImages((cur) => [...cur, ...urls].slice(0, 8));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (!images.length) return toast.error("Add at least one photo");
    const f = new FormData(e.currentTarget);
    const compare = Number(f.get("compareAtPrice"));
    setBusy(true);
    try {
      await saveProduct(product?.id ?? null, {
        merchantId: user.uid,
        merchantName: merchant?.storeName ?? "",
        merchantSlug: merchant?.slug ?? "",
        title: String(f.get("title")).trim(),
        description: String(f.get("description")).trim(),
        price: Number(f.get("price")),
        ...(compare > 0 ? { compareAtPrice: compare } : {}),
        images,
        categoryId: String(f.get("categoryId")),
        stock: Number(f.get("stock")),
        status: f.get("status") === "draft" ? "draft" : "active",
        createdAt: product?.createdAt ?? Date.now(),
      });
      await authedFetch("/api/revalidate", { method: "POST" });
      toast(product ? "Product updated" : "Product published");
      router.push("/merchant/products");
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-3">
      <Panel className="xl:col-span-2" title="Details">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Title" name="title" required defaultValue={product?.title} />
          <TextArea className="sm:col-span-2" label="Description" name="description" required defaultValue={product?.description} />
          <Field label="Price (SAR)" name="price" type="number" min={1} step="0.01" required defaultValue={product?.price} />
          <Field label="Compare-at price (optional)" name="compareAtPrice" type="number" min={0} step="0.01" defaultValue={product?.compareAtPrice} />
          <Field label="Stock" name="stock" type="number" min={0} required defaultValue={product?.stock ?? 10} />
          <SelectField label="Category" name="categoryId" required defaultValue={product?.categoryId}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
          <SelectField label="Visibility" name="status" defaultValue={product?.status ?? "active"}>
            <option value="active">Active — visible in the store</option>
            <option value="draft">Draft — hidden</option>
          </SelectField>
        </div>
      </Panel>
      <Panel title="Photos">
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              <div key={src} className="group relative aspect-square overflow-hidden rounded-2xl bg-sand">
                <Image src={src} alt="" fill sizes="120px" className="object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[9px] text-paper">Cover</span>}
                <button type="button" aria-label="Remove image" onClick={() => setImages((cur) => cur.filter((x) => x !== src))} className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-paper/90 opacity-0 transition group-hover:opacity-100">
                  <X className="size-3" />
                </button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-ink/15 text-[11px] text-muted transition hover:bg-cream">
              <ImageSquare weight="light" className="size-6" />
              {uploading ? "Uploading…" : "Add"}
              <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            </label>
          </div>
          <p className="text-[11px] text-muted">JPG or PNG, under 5 MB. The first photo is the cover.</p>
          <Button type="submit" disabled={busy || uploading} className="w-full justify-between">
            {product ? "Save changes" : "Publish product"}
          </Button>
        </div>
      </Panel>
    </form>
  );
}
