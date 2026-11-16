"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field } from "@/components/ui/primitives";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useSettings } from "@/lib/data/hooks";
import { saveSettings } from "@/lib/data/mutations";
import { computeSplit } from "@/lib/money";
import type { PlatformSettings } from "@/lib/types";

export default function AdminSettings() {
  const t = useT().admin;
  const { money } = useFormat();
  const { data: settings, loading } = useSettings();
  const [preview, setPreview] = useState<PlatformSettings | null>(null);
  const s = preview ?? settings;
  const example = computeSplit(1000, "tabby", s);

  function read(form: HTMLFormElement): PlatformSettings {
    const f = new FormData(form);
    const pct = (name: string) => Number(f.get(name)) / 100;
    return {
      commissionRate: pct("commissionRate"),
      tabbyFeeRate: pct("tabbyFeeRate"),
      tamaraFeeRate: pct("tamaraFeeRate"),
      passProviderFee: f.get("passProviderFee") === "on",
      vatRate: pct("vatRate"),
      vatOnCommission: f.get("vatOnCommission") === "on",
      sellerName: String(f.get("sellerName") ?? "").trim(),
      vatNumber: String(f.get("vatNumber") ?? "").replace(/\s+/g, ""),
      payoutHoldDays: Math.round(Number(f.get("payoutHoldDays")) || 0),
    };
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await saveSettings(read(e.currentTarget));
      toast(t.settingsSaved);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const lines: [string, number][] = [
    [t.customerPays, example.subtotal],
    [fmt(t.yourCommission, { n: (example.commissionRate * 100).toFixed(1) }), -example.commission],
    ...(s.vatOnCommission
      ? ([[fmt(t.commissionVatLine, { n: (s.vatRate * 100).toFixed(0) }), -example.commissionVat]] as [string, number][])
      : []),
    [
      fmt(t.tabbyFeeLine, { n: (example.providerFeeRate * 100).toFixed(2) }) + (s.passProviderFee ? "" : t.absorbed),
      s.passProviderFee ? -example.providerFee : 0,
    ],
  ];

  return (
    <>
      <PageHeader eyebrow={t.platform} title={<>{t.feesTitle} <span className="italic">{t.feesEm}</span></>} />
      {loading ? (
        <div className="h-80 animate-pulse rounded-[1.75rem] bg-cream" />
      ) : (
        <form onSubmit={submit} onChange={(e) => setPreview(read(e.currentTarget))} className="grid gap-4 xl:grid-cols-2">
          <Panel title={t.commissionPanel}>
            <div className="space-y-4 p-5">
              <Field label={t.defaultCommissionPct} name="commissionRate" type="number" dir="ltr" step="0.1" min={0} max={50} defaultValue={+(settings.commissionRate * 100).toFixed(2)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.tabbyFee} name="tabbyFeeRate" type="number" dir="ltr" step="0.01" min={0} max={20} defaultValue={+(settings.tabbyFeeRate * 100).toFixed(2)} />
                <Field label={t.tamaraFee} name="tamaraFeeRate" type="number" dir="ltr" step="0.01" min={0} max={20} defaultValue={+(settings.tamaraFeeRate * 100).toFixed(2)} />
              </div>
              <label className="flex items-center gap-3 rounded-2xl bg-cream/60 p-4 text-sm">
                <input type="checkbox" name="passProviderFee" defaultChecked={settings.passProviderFee} className="size-4 accent-[var(--color-ink)]" />
                {t.passFee}
              </label>
              <p className="text-[11px] text-muted">{t.settingsNote}</p>
            </div>
          </Panel>

          <Panel title={t.examplePanel}>
            <ul className="space-y-3 p-5 text-sm">
              {lines.map(([l, v]) => (
                <li key={l} className="flex justify-between gap-4 border-b border-ink/[0.05] pb-3">
                  <span className="text-ink/70">{l}</span>
                  <span className="tabular-nums">{money(v, { decimals: true })}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between pt-2">
                <span className="font-medium">{t.youTransfer}</span>
                <span className="font-display text-4xl tabular-nums text-ember">{money(example.payoutAmount, { decimals: true })}</span>
              </li>
              <li className="flex justify-between text-muted">
                <span>{t.youKeep}</span>
                <span className="tabular-nums">
                  {fmt(t.netOfFees, { amount: money(example.subtotal - example.payoutAmount - example.providerFee, { decimals: true }) })}
                </span>
              </li>
            </ul>
          </Panel>

          <Panel className="xl:col-span-2" title={t.vatPanel}>
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <Field label={t.sellerName} name="sellerName" required maxLength={120} defaultValue={settings.sellerName} />
              <Field label={t.vatNumber} name="vatNumber" dir="ltr" inputMode="numeric" pattern="\d{15}" defaultValue={settings.vatNumber} />
              <Field label={t.vatRatePct} name="vatRate" type="number" dir="ltr" step="0.1" min={0} max={30} defaultValue={+(settings.vatRate * 100).toFixed(2)} />
              <Field label={t.payoutHoldDays} name="payoutHoldDays" type="number" dir="ltr" step="1" min={0} max={60} defaultValue={settings.payoutHoldDays} />
              <label className="flex items-center gap-3 rounded-2xl bg-cream/60 p-4 text-sm sm:col-span-2 xl:col-span-3">
                <input type="checkbox" name="vatOnCommission" defaultChecked={settings.vatOnCommission} className="size-4 accent-[var(--color-ink)]" />
                {t.vatOnCommission}
              </label>
              <Button type="submit" className="justify-between">{t.saveSettings}</Button>
            </div>
          </Panel>
        </form>
      )}
    </>
  );
}
