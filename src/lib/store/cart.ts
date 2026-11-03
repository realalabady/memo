"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export interface CartLine {
  productId: string;
  title: string;
  image?: string;
  price: number;
  merchantName: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  open: boolean;
  add: (p: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      add: (p, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.productId === p.id);
          const lines = existing
            ? s.lines.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(20, l.quantity + qty) } : l))
            : [
                ...s.lines,
                {
                  productId: p.id,
                  title: p.title,
                  image: p.images[0],
                  price: p.price,
                  merchantName: p.merchantName,
                  quantity: qty,
                },
              ];
          return { lines, open: true };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(20, qty)) } : l)),
        })),
      remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [] }),
      setOpen: (open) => set({ open }),
    }),
    { name: "memo-cart", partialize: (s) => ({ lines: s.lines }) },
  ),
);

export const cartTotal = (lines: CartLine[]) =>
  Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
