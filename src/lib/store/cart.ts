"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export interface CartLine {
  productId: string;
  title: string;
  titleAr?: string;
  image?: string;
  price: number;
  merchantName: string;
  quantity: number;
  /** Last known stock (from the server re-check) */
  stock?: number;
  /** The product was removed, sold out or its store stopped selling */
  unavailable?: boolean;
}

interface CartState {
  lines: CartLine[];
  open: boolean;
  add: (p: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  /** Apply fresh server data. Returns true when a price, quantity or availability changed. */
  sync: (products: Product[]) => boolean;
}

const MAX_QTY = 20;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      open: false,
      add: (p, qty = 1) =>
        set((s) => {
          const cap = Math.min(MAX_QTY, Math.max(1, p.stock));
          const existing = s.lines.find((l) => l.productId === p.id);
          const lines = existing
            ? s.lines.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(cap, l.quantity + qty), stock: p.stock, unavailable: false } : l))
            : [
                ...s.lines,
                {
                  productId: p.id,
                  title: p.title,
                  ...(p.titleAr ? { titleAr: p.titleAr } : {}),
                  image: p.images[0],
                  price: p.price,
                  merchantName: p.merchantName,
                  quantity: Math.min(cap, qty),
                  stock: p.stock,
                },
              ];
          return { lines, open: true };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(MAX_QTY, l.stock ?? MAX_QTY, qty)) } : l,
          ),
        })),
      remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [] }),
      setOpen: (open) => set({ open }),
      sync: (products) => {
        const byId = new Map(products.map((p) => [p.id, p]));
        let changed = false;
        const lines = get().lines.map((l) => {
          const p = byId.get(l.productId);
          if (!p || p.stock <= 0) {
            if (!l.unavailable) changed = true;
            return { ...l, unavailable: true, stock: 0 };
          }
          const quantity = Math.min(l.quantity, p.stock, MAX_QTY);
          if (l.unavailable || quantity !== l.quantity || p.price !== l.price) changed = true;
          return {
            ...l,
            title: p.title,
            ...(p.titleAr ? { titleAr: p.titleAr } : {}),
            image: p.images[0],
            price: p.price,
            merchantName: p.merchantName,
            stock: p.stock,
            quantity,
            unavailable: false,
          };
        });
        set({ lines });
        return changed;
      },
    }),
    { name: "memo-cart", partialize: (s) => ({ lines: s.lines }) },
  ),
);

/** Lines that can actually be bought */
export const buyable = (lines: CartLine[]) => lines.filter((l) => !l.unavailable);
export const cartTotal = (lines: CartLine[]) =>
  Math.round(buyable(lines).reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
export const cartCount = (lines: CartLine[]) => buyable(lines).reduce((s, l) => s + l.quantity, 0);

/**
 * Re-checks the bag against the server (prices are never trusted from localStorage).
 * Runs whenever `active` turns true; `onChanged` fires when something was corrected.
 */
export function useCartSync(active: boolean, onChanged?: () => void) {
  useEffect(() => {
    if (!active) return;
    const ids = useCart.getState().lines.map((l) => l.productId);
    if (!ids.length) return;
    let cancelled = false;
    fetch(`/api/products?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { products: Product[] } | null) => {
        if (cancelled || !body) return;
        if (useCart.getState().sync(body.products)) onChanged?.();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the bag opens
  }, [active]);
}
