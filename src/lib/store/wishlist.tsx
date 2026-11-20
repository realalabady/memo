"use client";

import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth } from "@/lib/auth/auth-provider";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";

/**
 * Wishlist. Signed-in shoppers: users/{uid}/wishlist/{productId} in Firestore (follows them across devices).
 * Guests and demo mode: kept in this browser's localStorage.
 */
interface WishlistState {
  local: string[];
  remote: string[] | null;
  toggleLocal: (id: string) => void;
  setRemote: (ids: string[] | null) => void;
}

const useStore = create<WishlistState>()(
  persist(
    (set) => ({
      local: [],
      remote: null,
      toggleLocal: (id) => set((s) => ({ local: s.local.includes(id) ? s.local.filter((x) => x !== id) : [...s.local, id] })),
      setRemote: (remote) => set({ remote }),
    }),
    { name: "memo-wishlist", partialize: (s) => ({ local: s.local }) },
  ),
);

/** Mount once (store layout): keeps the store in step with the signed-in shopper's Firestore wishlist. */
export function WishlistSync() {
  const { user, demo } = useAuth();
  const setRemote = useStore((s) => s.setRemote);
  const uid = !demo && isFirebaseConfigured ? user?.uid : undefined;
  useEffect(() => {
    if (!uid) {
      setRemote(null);
      return;
    }
    return onSnapshot(
      collection(db(), "users", uid, "wishlist"),
      (snap) => setRemote(snap.docs.map((d) => d.id)),
      () => setRemote([]),
    );
  }, [uid, setRemote]);
  return null;
}

export function useWishlist() {
  const { user, demo } = useAuth();
  const uid = !demo && isFirebaseConfigured ? user?.uid : undefined;
  const local = useStore((s) => s.local);
  const remote = useStore((s) => s.remote);
  const toggleLocal = useStore((s) => s.toggleLocal);
  // localStorage is only known after mount; render "not saved" until then to match the server HTML.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once
  useEffect(() => setMounted(true), []);

  const ids = !mounted ? [] : uid ? (remote ?? []) : local;

  /** Returns true when the product is now saved. */
  const toggle = useCallback(
    async (productId: string) => {
      if (!uid) {
        const saved = !useStore.getState().local.includes(productId);
        toggleLocal(productId);
        return saved;
      }
      const ref = doc(db(), "users", uid, "wishlist", productId);
      const saved = !(useStore.getState().remote ?? []).includes(productId);
      if (saved) await setDoc(ref, { productId, createdAt: Date.now() });
      else await deleteDoc(ref);
      return saved;
    },
    [uid, toggleLocal],
  );

  return { ids, has: (id: string) => ids.includes(id), toggle, ready: mounted && (!uid || remote !== null) };
}
