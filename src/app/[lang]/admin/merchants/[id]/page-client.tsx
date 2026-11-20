"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, StatCard, sum, Table } from "@/components/dashboard/widgets";
import { ProviderChip, StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useMerchantBank, useMerchantContact, useMerchantOrders, useMerchantProducts, useMerchants, usePayouts, useSettings } from "@/lib/data/hooks";
import { setMerchantCommission, setMerchantStatus } from "@/lib/data/mutations";
import type { Merchant, MerchantStatus } from "@/lib/types";
import { shortId } from "@/lib/utils";

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const known = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  return (
    <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
      {known.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
          <dd className="mt-0.5 break-words text-[13px]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Actions({ merchant }: { merchant: Merchant }) {
  const t = useT().admin;
  const status = useT().status;
  const common = useT().common;
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function set(s: MerchantStatus, reason?: string) {
    setBusy(true);
    try {
      await setMerchantStatus(merchant.id, s, reason);
      toast(fmt(t.merchantStatus, { status: status[s] ?? s }));
      setRejecting(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (reason) set("rejected", reason);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {merchant.status !== "approved" && (
          <button disabled={busy} onClick={() => set("approved")} className="rounded-full bg-ink px-4 py-2 text-sm text-paper">{t.approve}</button>
        )}
        {merchant.status === "pending" && !rejecting && (
          <button disabled={busy} onClick={() => setRejecting(true)} className="rounded-full px-4 py-2 text-sm text-muted ring-1 ring-ink/10 hover:text-ember">{t.reject}</button>
        )}
        {merchant.status === "approved" && (
          <button disabled={busy} onClick={() => set("suspended")} className="rounded-full px-4 py-2 text-sm text-muted ring-1 ring-ink/10 hover:text-ember">{t.suspend}</button>
        )}
      </div>
      {rejecting && (
        <form onSubmit={reject} className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted">{t.rejectReason}</span>
            <textarea name="reason" required minLength={3} maxLength={300} rows={2} autoFocus className="w-full rounded-2xl bg-paper p-3 text-sm outline-none ring-1 ring-ink/10 focus:ring-ink/30" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-full bg-ember px-4 py-2 text-xs text-paper">{t.confirmReject}</button>
            <button type="button" onClick={() => setRejecting(false)} className="px-3 text-xs text-muted">{common.cancel}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Commission({ merchant, fallback }: { merchant: Merchant; fallback: number }) {
  const t = useT().admin;
  const [value, setValue] = useState(merchant.commissionRate === undefined || merchant.commissionRate === null ? "" : String(Math.round(merchant.commissionRate * 1000) / 10));

  async function save(e: FormEvent) {
    e.preventDefault();
    const rate = value.trim() === "" ? null : Number(value) / 100;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 0.5)) return toast.error("0–50%");
    try {
      await setMerchantCommission(merchant.id, rate);
      toast(t.commissionUpdated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="space-y-1.5">
      <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{t.commissionPct}</span>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={50}
          step={0.5}
          dir="ltr"
          value={value}
          placeholder={String(Math.round(fallback * 100))}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 w-28 rounded-full bg-paper px-4 text-sm outline-none ring-1 ring-ink/10 focus:ring-ink/30"
        />
        <button type="submit" className="rounded-full bg-ink px-4 text-xs text-paper">{t.saveCommission}</button>
      </div>
      <p className="text-[11px] text-muted">{fmt(t.commissionHint, { n: Math.round(fallback * 100) })}</p>
    </form>
  );
}

export default function AdminMerchantDetail() {
  const t = useT().admin;
  const dash = useT().dash;
  const col = dash.col;
  const m = useT().merchant;
  const { money, date, lang } = useFormat();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: merchants, loading } = useMerchants();
  const merchant = merchants.find((m) => m.id === id);
  const { data: contact } = useMerchantContact(merchant ? id : null);
  const { data: bank } = useMerchantBank(merchant ? id : null);
  const { data: orders } = useMerchantOrders(merchant ? id : null);
  const { data: payouts } = usePayouts(merchant ? id : null);
  const { data: products } = useMerchantProducts(merchant ? id : null);
  const { data: settings } = useSettings();

  if (loading) return <div className="h-96 animate-pulse rounded-[1.75rem] bg-cream" />;
  if (!merchant) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">{t.storeNotFound}</p>
        <Link href="/admin/merchants" className="mt-4 inline-block text-sm underline underline-offset-4">{t.backToStores}</Link>
      </div>
    );
  }

  const paid = orders.filter((o) => o.paymentStatus === "captured");
  const owed = paid.filter((o) => o.payoutStatus !== "paid");

  function openDashboard() {
    try {
      localStorage.setItem("memo-view-as", id);
    } catch {}
    router.push("/merchant");
  }

  return (
    <>
      <Link href="/admin/merchants" className="mb-4 inline-block text-xs text-muted hover:text-ink">{t.backToStores}</Link>
      <PageHeader
        eyebrow={merchant.city ?? ""}
        title={
          <span className="flex flex-wrap items-center gap-4">
            {merchant.logoUrl && (
              <span className="relative size-12 overflow-hidden rounded-full bg-sand">
                <Image src={merchant.logoUrl} alt="" fill sizes="48px" className="object-cover" />
              </span>
            )}
            {merchant.storeName}
          </span>
        }
        actions={
          <>
            {merchant.status === "approved" && (
              <Link href={`/store/${merchant.slug}`} target="_blank" className="rounded-full px-4 py-2.5 text-sm text-muted ring-1 ring-ink/10 hover:text-ink">{t.storefrontLink}</Link>
            )}
            <button onClick={openDashboard} className="rounded-full bg-ink px-4 py-2.5 text-sm text-paper">{t.viewDashboard}</button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label={t.sales} value={sum(paid, (o) => o.subtotal)} hint={fmt(dash.orders, { n: paid.length })} />
        <StatCard index={1} label={col.commission} value={sum(paid, (o) => o.commission)} />
        <StatCard index={2} tone="ember" label={t.owed} value={sum(owed, (o) => o.payoutAmount)} />
        <StatCard index={3} tone="ink" label={t.transferred} value={sum(payouts, (p) => p.amount)} hint={fmt(t.payoutsRecorded, { n: payouts.length })} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title={t.profile}>
          <div className="space-y-5 p-5 pb-0">
            <div className="flex items-center gap-3">
              <StatusPill status={merchant.status} />
              {merchant.rejectionReason && <span className="text-[12px] text-ember">{merchant.rejectionReason}</span>}
            </div>
            <Actions merchant={merchant} />
            <Commission key={String(merchant.commissionRate)} merchant={merchant} fallback={settings.commissionRate} />
          </div>
          <Facts
            rows={[
              [t.joined, date(merchant.createdAt)],
              [t.productsCount, String(products.length)],
              [t.termsAccepted, merchant.termsAcceptedAt ? `${date(merchant.termsAcceptedAt)} · v${merchant.termsVersion ?? "?"}` : t.termsNone],
              ["URL", <span key="u" dir="ltr">/store/{merchant.slug}</span>],
              [m.tagline, localized(merchant, "tagline", lang)],
              [m.about, localized(merchant, "bio", lang)],
            ]}
          />
        </Panel>
        <Panel title={t.kyc}>
          <Facts
            rows={[
              [t.contactEmail, <span key="e" dir="ltr">{contact.email || merchant.email}</span>],
              [t.contactPhone, <span key="p" dir="ltr">{contact.phone || merchant.phone}</span>],
              [t.crNo, <span key="c" dir="ltr" className="font-mono">{contact.crNumber}</span>],
              [t.vatNo, <span key="v" dir="ltr" className="font-mono">{contact.vatNumber}</span>],
            ]}
          />
          {!contact.email && !contact.crNumber && !merchant.email && <p className="px-5 pb-5 text-[13px] text-muted">{t.noContact}</p>}
        </Panel>
        <Panel title={t.bankPanel}>
          {bank.iban ? (
            <Facts
              rows={[
                [m.accountHolder, bank.accountHolder],
                [m.bank, bank.bankName],
                [m.iban, <span key="i" dir="ltr" className="font-mono">{bank.iban}</span>],
              ]}
            />
          ) : (
            <p className="p-5 text-[13px] text-muted">{t.noBank}</p>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title={t.latest}>
        <Table head={[col.order, col.date, col.customer, col.via, col.sale, col.merchantGets, col.payout]} empty={!orders.length}>
          {orders.slice(0, 20).map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">#{shortId(o.orderId)}</td>
              <td className="whitespace-nowrap text-muted">{date(o.createdAt)}</td>
              <td className="whitespace-nowrap">{o.customer.firstName} {o.customer.lastName}</td>
              <td>{o.provider !== "demo" && <ProviderChip provider={o.provider} />}</td>
              <td className="tabular-nums">{money(o.subtotal)}</td>
              <td className="tabular-nums font-medium">{money(o.payoutAmount, { decimals: true })}</td>
              <td><StatusPill status={o.paymentStatus === "captured" ? o.payoutStatus : o.paymentStatus} /></td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
