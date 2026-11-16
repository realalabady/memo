"use client";

import { PageHeader } from "@/components/dashboard/shell";
import { ProductForm } from "@/components/dashboard/product-form";
import { useT } from "@/i18n/client";

export default function NewProductPage() {
  const t = useT().merchant;
  return (
    <>
      <PageHeader eyebrow={t.newProductEyebrow} title={<>{t.newProductTitle} <span className="italic">{t.newProductEm}</span></>} />
      <ProductForm />
    </>
  );
}
