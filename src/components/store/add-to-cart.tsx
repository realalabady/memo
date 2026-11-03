"use client";

import { Handbag } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { useCart } from "@/lib/store/cart";
import type { Product } from "@/lib/types";

export function AddToCart({ product }: { product: Product }) {
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
        toast(`${product.title} added to your bag`);
      }}
    >
      {soldOut ? "Sold out" : "Add to bag"}
    </Button>
  );
}
