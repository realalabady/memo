"use client";

import { PageHeader } from "@/components/dashboard/shell";
import { ProductForm } from "@/components/dashboard/product-form";
import { useT } from "@/i18n/client";
import { useMerchantScope } from "@/lib/auth/merchant-scope";

export default function NewProductPage() {
  const t = useT().merchant;
  const admin = useT().admin;
  const { readOnly } = useMerchantScope();
  return (
    <>
      <PageHeader eyebrow={t.newProductEyebrow} title={<>{t.newProductTitle} <span className="italic">{t.newProductEm}</span></>} />
      {readOnly ? <p className="text-muted">{admin.readOnly}</p> : <ProductForm />}
    </>
  );
}
