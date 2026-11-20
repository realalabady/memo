"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { StarRow } from "@/components/store/stars";
import { useFormat, useT } from "@/i18n/client";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { useMerchantScope } from "@/lib/auth/merchant-scope";
import type { Review } from "@/lib/types";

type Row = Review & { productId: string; productTitle: string; productTitleAr: string };

export default function MerchantReviews() {
  const t = useT().reviews;
  const dash = useT().dash;
  const { date, lang } = useFormat();
  const { user, demo } = useAuth();
  const { readOnly } = useMerchantScope();
  const adminT = useT().admin;
  const authedFetch = useAuthedFetch();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (demo || !user || readOnly) return setRows([]);
    const res = await authedFetch("/api/merchant/reviews");
    setRows(res.ok ? ((await res.json()) as { reviews: Row[] }).reviews : []);
  }, [demo, user, readOnly, authedFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once the session is known
    load().catch(() => setRows([]));
  }, [load]);

  async function reply(e: FormEvent<HTMLFormElement>, r: Row) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("text") ?? "").trim();
    try {
      const res = await authedFetch("/api/merchant/reviews", {
        method: "POST",
        body: JSON.stringify({ productId: r.productId, reviewUid: r.uid, text }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast(t.replySaved);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={t.nav} title={<>{t.merchantTitle} <span className="italic">{t.merchantEm}</span></>} />
      <Panel>
        {rows === null ? (
          <div className="m-5 h-40 animate-pulse rounded-2xl bg-cream" />
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">{readOnly ? adminT.readOnly : t.none}</p>
        ) : (
          <ul className="divide-y divide-ink/[0.05]">
            {rows.map((r) => (
              <li key={`${r.productId}_${r.uid}`} className="grid gap-4 p-5 lg:grid-cols-2">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StarRow value={r.rating} />
                    <span className="text-sm font-medium">{r.displayName}</span>
                    <span className="text-xs text-muted">{date(r.updatedAt ?? r.createdAt)}</span>
                    {r.hidden && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-paper">{t.hidden}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {dash.col.product}: {(lang === "ar" && r.productTitleAr) || r.productTitle}
                  </p>
                  {r.text && <p className="mt-3 whitespace-pre-line text-sm text-ink/75">{r.text}</p>}
                </div>
                <form onSubmit={(e) => reply(e, r)} className="flex flex-col gap-2">
                  <textarea
                    name="text"
                    rows={3}
                    maxLength={1000}
                    defaultValue={r.reply?.text}
                    placeholder={t.replyPlaceholder}
                    aria-label={t.reply}
                    className="w-full rounded-2xl bg-cream/60 p-3 text-sm outline-none ring-1 ring-ink/[0.06] focus:ring-ink/30"
                  />
                  <button type="submit" className="self-end rounded-full bg-ink px-4 py-2 text-xs text-paper">
                    {t.reply}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
