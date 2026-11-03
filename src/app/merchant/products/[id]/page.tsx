"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/shell";
import { ProductForm } from "@/components/dashboard/product-form";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantProducts } from "@/lib/data/hooks";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading } = useMerchantProducts(user?.uid ?? null);
  const product = data.find((p) => p.id === id);

  return (
    <>
      <PageHeader eyebrow="Edit product" title={<span className="italic">{product?.title ?? "…"}</span>} />
      {loading ? (
        <div className="h-96 animate-pulse rounded-[1.75rem] bg-cream" />
      ) : product ? (
        <ProductForm product={product} />
      ) : (
        <p className="text-muted">Product not found.</p>
      )}
    </>
  );
}
