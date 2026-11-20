"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAllProducts, useCategories } from "@/lib/data/hooks";
import { setProductHidden } from "@/lib/data/mutations";
import { normalize } from "@/lib/search";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "live" | "drafts" | "hidden";

export default function AdminProducts() {
  const t = useT().moderation;
  const common = useT().common;
  const { money, lang } = useFormat();
  const { data: products, loading } = useAllProducts();
  const { data: categories } = useCategories();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [hiding, setHiding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const catName = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? localized(c, "name", lang) : id;
  };

  const rows = useMemo(() => {
    const s = normalize(q);
    return products.filter(
      (p) =>
        (filter === "all" ||
          (filter === "live" && p.status === "active") ||
          (filter === "drafts" && p.status === "draft" && !p.hiddenByAdmin) ||
          (filter === "hidden" && p.hiddenByAdmin)) &&
        (!s || normalize([p.title, p.titleAr ?? "", p.merchantName].join(" ")).includes(s)),
    );
  }, [products, q, filter]);

  async function change(p: Product, hidden: boolean, reason?: string) {
    setBusy(true);
    try {
      await setProductHidden(p.id, hidden, reason);
      toast(hidden ? t.hiddenDone : t.releasedDone);
      setHiding(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitHide(e: FormEvent<HTMLFormElement>, p: Product) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (reason) change(p, true, reason);
  }

  const filters: [Filter, string][] = [
    ["all", t.all],
    ["live", t.live],
    ["drafts", t.drafts],
    ["hidden", t.hidden],
  ];

  return (
    <>
      <PageHeader eyebrow={fmt(t.eyebrow, { n: products.length })} title={<>{t.title} <span className="italic">{t.titleEm}</span></>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-paper px-4 ring-1 ring-ink/[0.08] sm:min-w-64 md:max-w-sm">
          <MagnifyingGlass weight="light" className="size-4 shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="w-full min-w-0 bg-transparent text-sm outline-none" />
        </label>
        <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-ink/[0.04] p-1">
          {filters.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[12px] transition", filter === key ? "bg-paper shadow-sm" : "text-muted")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <Panel>
        <Table head={[t.product, t.store, t.category, t.price, t.stock, t.status, t.rating, ""]} empty={!loading && !rows.length}>
          {rows.map((p) => (
            <Fragment key={p.id}>
              <tr>
                <td>
                  <div className="flex min-w-48 items-center gap-3">
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-sand">
                      {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-56 truncate">{localized(p, "title", lang)}</span>
                      {p.hiddenByAdmin && p.hiddenReason && <span className="block max-w-56 truncate text-[11px] text-ember">{p.hiddenReason}</span>}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap">{p.merchantName}</td>
                <td className="whitespace-nowrap text-muted">{catName(p.categoryId)}</td>
                <td className="tabular-nums">{money(p.price)}</td>
                <td className="tabular-nums">{p.stock}</td>
                <td><StatusPill status={p.hiddenByAdmin ? "hidden" : p.status} /></td>
                <td className="tabular-nums text-muted">{p.ratingCount ? `${(p.ratingAvg ?? 0).toFixed(1)} (${p.ratingCount})` : "—"}</td>
                <td className="whitespace-nowrap text-end">
                  {p.status === "active" && (
                    <Link href={`/product/${p.id}`} target="_blank" className="me-2 text-xs text-muted hover:text-ink">{t.view}</Link>
                  )}
                  {p.hiddenByAdmin ? (
                    <button disabled={busy} onClick={() => change(p, false)} className="rounded-full bg-ink px-3 py-1.5 text-xs text-paper">{t.release}</button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => setHiding(hiding === p.id ? null : p.id)}
                      aria-expanded={hiding === p.id}
                      className="rounded-full px-3 py-1.5 text-xs text-muted ring-1 ring-ink/10 hover:text-ember"
                    >
                      {t.hide}
                    </button>
                  )}
                </td>
              </tr>
              {hiding === p.id && (
                <tr>
                  <td colSpan={8} className="!bg-cream/40">
                    <form onSubmit={(e) => submitHide(e, p)} className="flex flex-wrap items-end gap-2">
                      <label className="min-w-0 flex-1">
                        <span className="mb-1 block text-[11px] text-muted">{t.reason}</span>
                        <input name="reason" required minLength={3} maxLength={300} autoFocus className="h-10 w-full rounded-full bg-paper px-4 text-sm outline-none ring-1 ring-ink/10 focus:ring-ink/30" />
                      </label>
                      <button type="submit" disabled={busy} className="h-10 rounded-full bg-ember px-4 text-xs text-paper">{t.hide}</button>
                      <button type="button" onClick={() => setHiding(null)} className="h-10 px-3 text-xs text-muted">{common.cancel}</button>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </Table>
      </Panel>
    </>
  );
}
