"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field } from "@/components/ui/primitives";
import { useSettings } from "@/lib/data/hooks";
import { saveSettings } from "@/lib/data/mutations";
import { computeSplit } from "@/lib/money";
import type { PlatformSettings } from "@/lib/types";
import { formatSAR } from "@/lib/utils";

export default function AdminSettings() {
  const { data: settings, loading } = useSettings();
  const [preview, setPreview] = useState<PlatformSettings | null>(null);
  const s = preview ?? settings;
  const example = computeSplit(1000, "tabby", s);

  function read(form: HTMLFormElement): PlatformSettings {
    const f = new FormData(form);
    return {
      commissionRate: Number(f.get("commissionRate")) / 100,
      tabbyFeeRate: Number(f.get("tabbyFeeRate")) / 100,
      tamaraFeeRate: Number(f.get("tamaraFeeRate")) / 100,
      passProviderFee: f.get("passProviderFee") === "on",
    };
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await saveSettings(read(e.currentTarget));
      toast("Settings saved — applies to new orders");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Platform" title={<>Fees & <span className="italic">rules</span></>} />
      {loading ? (
        <div className="h-80 animate-pulse rounded-[1.75rem] bg-cream" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Commission">
            <form onSubmit={submit} onChange={(e) => setPreview(read(e.currentTarget))} className="space-y-4 p-5">
              <Field label="Default commission %" name="commissionRate" type="number" step="0.1" min={0} max={50} defaultValue={+(settings.commissionRate * 100).toFixed(2)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tabby fee % (your contract)" name="tabbyFeeRate" type="number" step="0.01" min={0} max={20} defaultValue={+(settings.tabbyFeeRate * 100).toFixed(2)} />
                <Field label="Tamara fee % (your contract)" name="tamaraFeeRate" type="number" step="0.01" min={0} max={20} defaultValue={+(settings.tamaraFeeRate * 100).toFixed(2)} />
              </div>
              <label className="flex items-center gap-3 rounded-2xl bg-cream/60 p-4 text-sm">
                <input type="checkbox" name="passProviderFee" defaultChecked={settings.passProviderFee} className="size-4 accent-[var(--color-ink)]" />
                Deduct the Tabby/Tamara fee from the merchant&apos;s payout
              </label>
              <Button type="submit" className="w-full justify-between">Save settings</Button>
              <p className="text-[11px] text-muted">Rates are snapshotted on each order, so changes never rewrite past payouts. Per-store overrides live under Merchants.</p>
            </form>
          </Panel>
          <Panel title="On a SAR 1,000 Tabby sale">
            <ul className="space-y-3 p-5 text-sm">
              {[
                ["Customer pays (to your Tabby account)", example.subtotal],
                [`Your commission (${(example.commissionRate * 100).toFixed(1)}%)`, -example.commission],
                [`Tabby fee (${(example.providerFeeRate * 100).toFixed(2)}%)${s.passProviderFee ? "" : " — absorbed by you"}`, s.passProviderFee ? -example.providerFee : 0],
              ].map(([l, v]) => (
                <li key={l as string} className="flex justify-between border-b border-ink/[0.05] pb-3">
                  <span className="text-ink/70">{l}</span>
                  <span className="tabular-nums">{formatSAR(v as number, { decimals: true })}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between pt-2">
                <span className="font-medium">You transfer to the merchant</span>
                <span className="font-display text-4xl tabular-nums text-ember">{formatSAR(example.payoutAmount, { decimals: true })}</span>
              </li>
              <li className="flex justify-between text-muted">
                <span>You keep</span>
                <span className="tabular-nums">{formatSAR(example.subtotal - example.payoutAmount - example.providerFee, { decimals: true })} net of fees</span>
              </li>
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
