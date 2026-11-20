"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchants } from "@/lib/data/hooks";
import type { Merchant } from "@/lib/types";

/**
 * Which store the merchant dashboard is showing.
 *  - a merchant sees their own store and can edit it
 *  - an admin picks any store and sees it READ-ONLY (they never act as the store)
 */
interface Scope {
  merchantId: string | null;
  merchant: Merchant | null;
  readOnly: boolean;
}

const Ctx = createContext<Scope>({ merchantId: null, merchant: null, readOnly: false });
const KEY = "memo-view-as";

function AdminScope({ children }: { children: ReactNode }) {
  const t = useT().admin;
  const { data: merchants } = useMerchants();
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the last viewed store once
      setPicked(localStorage.getItem(KEY));
    } catch {}
  }, []);
  const merchant = merchants.find((m) => m.id === picked) ?? null;
  const value = useMemo(() => ({ merchantId: merchant?.id ?? null, merchant, readOnly: true }), [merchant]);

  return (
    <Ctx.Provider value={value}>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-paper">
        <label className="flex items-center gap-3">
          <span className="text-paper/60">{t.viewingAs}</span>
          <select
            value={merchant?.id ?? ""}
            onChange={(e) => {
              setPicked(e.target.value || null);
              try {
                localStorage.setItem(KEY, e.target.value);
              } catch {}
            }}
            className="rounded-full bg-white/10 px-3 py-1.5 text-paper outline-none [&>option]:text-ink"
          >
            <option value="">{t.pickStore}</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.storeName}</option>
            ))}
          </select>
        </label>
        <span className="text-[12px] text-paper/60">{t.readOnly}</span>
      </div>
      {children}
    </Ctx.Provider>
  );
}

export function MerchantScopeProvider({ children }: { children: ReactNode }) {
  const { user, merchant, profile } = useAuth();
  const own = useMemo(() => ({ merchantId: user?.uid ?? null, merchant, readOnly: false }), [user?.uid, merchant]);
  if (profile?.role === "admin") return <AdminScope>{children}</AdminScope>;
  return <Ctx.Provider value={own}>{children}</Ctx.Provider>;
}

export const useMerchantScope = () => useContext(Ctx);
