"use client";

import { Handbag } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useCart } from "@/lib/store/cart";
import type { Product } from "@/lib/types";

export function AddToCart({ product }: { product: Product }) {
  const t = useT().product;
  const lang = useLocale();
  const add = useCart((s) => s.add);
  const soldOut = product.stock <= 0;
  return (
    <Button
      size="lg"
      className="w-full justify-between"
      disabled={soldOut}
      icon={<Handbag weight="light" className="size-4" />}
      onClick={() => {
        add(product);
        toast(fmt(t.added, { title: localized(product, "title", lang) }));
      }}
    >
      {soldOut ? t.soldOut : t.addToBag}
    </Button>
  );
}
