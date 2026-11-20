"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field } from "@/components/ui/primitives";
import { useFormat, useT } from "@/i18n/client";
import { useLegalPages } from "@/lib/data/hooks";
import { resetLegalPage, saveLegalPage } from "@/lib/data/mutations";
import { LEGAL_SLUGS, parseBlocks, type LegalPage, type LegalSlug } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Same block format as the public page, rendered small for the preview. */
function Preview({ text, dir }: { text: string; dir: "ltr" | "rtl" }) {
  return (
    <div dir={dir} className="max-h-[32rem] space-y-3 overflow-y-auto rounded-2xl bg-cream/50 p-5 text-[13px] leading-relaxed text-ink/75">
      {parseBlocks(text).map((b, i) =>
        b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1 ps-5">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ) : b.kind === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <p key={i} className={cn("font-medium text-ink", b.kind === "h2" ? "pt-2 text-base" : "text-sm")}>{b.text}</p>
        ),
      )}
    </div>
  );
}

const area = "min-h-80 w-full rounded-2xl bg-paper p-4 font-mono text-[13px] leading-relaxed outline-none ring-1 ring-ink/10 focus:ring-ink/30";

function Editor({ page }: { page: LegalPage }) {
  const t = useT().legal;
  const common = useT().common;
  const { date } = useFormat();
  const [draft, setDraft] = useState(page);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const set = (k: "title" | "titleAr" | "body" | "bodyAr", v: string) => setDraft((d) => ({ ...d, [k]: v }));

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast(msg);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={draft.title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted">{page.updatedAt ? date(page.updatedAt, true) : t.builtIn}</span>
          <Link href={`/legal/${page.slug}`} target="_blank" className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline">{t.view}</Link>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t.titleEn} dir="ltr" maxLength={120} value={draft.title} onChange={(e) => set("title", e.target.value)} />
          <Field label={t.titleAr} dir="rtl" maxLength={120} value={draft.titleAr} onChange={(e) => set("titleAr", e.target.value)} />
        </div>
        <p className="rounded-2xl bg-cream/70 p-3 text-[12px] text-ink/70">{t.formatHint}</p>
        <div className="flex gap-1 rounded-full bg-ink/[0.04] p-1 text-[12px] sm:w-fit">
          {[false, true].map((on) => (
            <button key={String(on)} type="button" onClick={() => setPreview(on)} className={cn("flex-1 rounded-full px-4 py-1.5 transition", preview === on ? "bg-paper shadow-sm" : "text-muted")}>
              {on ? t.preview : common.edit}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["body", t.bodyEn, "ltr"],
              ["bodyAr", t.bodyAr, "rtl"],
            ] as const
          ).map(([key, label, dir]) => (
            <label key={key} className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
              {preview ? (
                <Preview text={draft[key]} dir={dir} />
              ) : (
                <textarea dir={dir} maxLength={30_000} value={draft[key]} onChange={(e) => set(key, e.target.value)} className={area} />
              )}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={busy || !page.updatedAt}
            onClick={() => confirm(t.confirmReset) && run(() => resetLegalPage(page.slug), t.saved)}
            className="text-xs text-muted hover:text-ember disabled:opacity-40"
          >
            {t.reset}
          </button>
          <Button disabled={busy} onClick={() => run(() => saveLegalPage(page.slug, draft), t.saved)}>{t.save}</Button>
        </div>
      </div>
    </Panel>
  );
}

export default function AdminPages() {
  const t = useT().legal;
  const { data: pages, loading } = useLegalPages();
  const [slug, setSlug] = useState<LegalSlug>("terms");
  const page = pages.find((p) => p.slug === slug)!;

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={<>{t.title} <span className="italic">{t.titleEm}</span></>} />
      <p className="mb-4 rounded-2xl bg-ember-soft px-4 py-3 text-[13px] text-[#8f321a]">{t.lawyerNote}</p>
      <div role="tablist" className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-full bg-ink/[0.04] p-1">
        {LEGAL_SLUGS.map((s) => {
          const p = pages.find((x) => x.slug === s)!;
          return (
            <button key={s} role="tab" aria-selected={slug === s} onClick={() => setSlug(s)} className={cn("shrink-0 rounded-full px-4 py-2 text-[13px] transition", slug === s ? "bg-paper shadow-sm" : "text-muted hover:text-ink")}>
              {p.title}
            </button>
          );
        })}
      </div>
      {loading ? <div className="h-96 animate-pulse rounded-[1.75rem] bg-cream" /> : <Editor key={`${slug}-${page.updatedAt}`} page={page} />}
    </>
  );
}
