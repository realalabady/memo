"use client";

import { PageHeader } from "@/components/dashboard/shell";
import { ProductForm } from "@/components/dashboard/product-form";

export default function NewProductPage() {
  return (
    <>
      <PageHeader eyebrow="Products" title={<>New <span className="italic">product</span></>} />
      <ProductForm />
    </>
  );
}
