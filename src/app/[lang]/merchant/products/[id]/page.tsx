"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/shell";
import { ProductForm } from "@/components/dashboard/product-form";
import { localized } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantProducts } from "@/lib/data/hooks";

export default function EditProductPage() {
  const t = useT().merchant;
  const lang = useLocale();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading } = useMerchantProducts(user?.uid ?? null);
  const product = data.find((p) => p.id === id);

  return (
    <>
      <PageHeader eyebrow={t.editProduct} title={<span className="italic">{product ? localized(product, "title", lang) : "…"}</span>} />
      {loading ? (
        <div className="h-96 animate-pulse rounded-[1.75rem] bg-cream" />
      ) : product ? (
        <ProductForm product={product} />
      ) : (
        <p className="text-muted">{t.productNotFound}</p>
      )}
    </>
  );
}
