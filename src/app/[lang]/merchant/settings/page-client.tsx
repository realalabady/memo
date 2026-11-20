"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field, TextArea } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { useMerchantScope } from "@/lib/auth/merchant-scope";
import { useMerchantBank, useMerchantContact } from "@/lib/data/hooks";
import { saveMerchantBank, updateMerchantProfile, uploadImage } from "@/lib/data/mutations";

export default function MerchantSettings() {
  const t = useT().merchant;
  const admin = useT().admin;
  const { merchantId, merchant, readOnly } = useMerchantScope();
  const { data: bank, loading } = useMerchantBank(merchantId);
  const { data: contact } = useMerchantContact(merchantId);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const logoUrl = logo ?? merchant?.logoUrl;
  const bannerUrl = banner ?? merchant?.bannerUrl;

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!merchantId || readOnly) return;
    const f = new FormData(e.currentTarget);
    try {
      await updateMerchantProfile(merchantId, {
        storeName: String(f.get("storeName")),
        tagline: String(f.get("tagline")),
        bio: String(f.get("bio")),
        city: String(f.get("city")),
        phone: String(f.get("phone")),
        ...(logoUrl ? { logoUrl } : {}),
        ...(bannerUrl ? { bannerUrl } : {}),
      });
      toast(t.storeUpdated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function saveBank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!merchantId || readOnly) return;
    const f = new FormData(e.currentTarget);
    const iban = String(f.get("iban")).replace(/\s+/g, "").toUpperCase();
    if (!/^SA\d{22}$/.test(iban)) return toast.error(t.ibanInvalid);
    try {
      await saveMerchantBank(merchantId, {
        accountHolder: String(f.get("accountHolder")),
        bankName: String(f.get("bankName")),
        iban,
      });
      toast(t.bankSaved);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function upload(file: File | undefined, set: (url: string) => void) {
    if (!file || !merchantId || readOnly) return;
    try {
      set(await uploadImage(`merchants/${merchantId}`, file));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={t.settingsEyebrow} title={<>{t.settingsTitle} <span className="italic">{t.settingsEm}</span></>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={t.storefront}>
          {/* keyed so the uncontrolled fields refill once the store + contact docs load */}
          <form key={`${merchant?.id ?? "loading"}-${contact.updatedAt}`} onSubmit={saveProfile}>
            <fieldset disabled={readOnly || !merchant} className="grid min-w-0 gap-4 p-5">
              <label className="block cursor-pointer">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{t.banner}</span>
                <span className="relative block aspect-[4/1] overflow-hidden rounded-2xl bg-sand ring-1 ring-ink/10">
                  {bannerUrl && <Image src={bannerUrl} alt="" fill sizes="600px" className="object-cover" />}
                  <span className="absolute bottom-2 end-2 rounded-full bg-paper/90 px-3 py-1 text-xs">{t.changeBanner}</span>
                </span>
                <span className="mt-1 block text-[11px] text-muted">{t.bannerHint}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0], setBanner)} />
              </label>
              <label className="flex cursor-pointer items-center gap-4">
                <span className="relative size-16 overflow-hidden rounded-full bg-sand ring-1 ring-ink/10">
                  {logoUrl && <Image src={logoUrl} alt="" fill sizes="64px" className="object-cover" />}
                </span>
                <span className="text-sm text-muted underline underline-offset-4">{t.changeLogo}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0], setLogo)} />
              </label>
              <Field label={t.storeName} name="storeName" required minLength={2} maxLength={60} defaultValue={merchant?.storeName} />
              <Field label={t.tagline} name="tagline" maxLength={120} defaultValue={merchant?.tagline} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.city} name="city" maxLength={60} defaultValue={merchant?.city} />
                <Field label={t.mobile} name="phone" dir="ltr" maxLength={20} defaultValue={contact.phone || merchant?.phone} />
              </div>
              <TextArea label={t.about} name="bio" maxLength={2000} defaultValue={merchant?.bio} />
              {!readOnly && <Button type="submit" className="w-full justify-between">{t.saveStorefront}</Button>}
            </fieldset>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title={t.payoutAccount}>
            {loading ? (
              <div className="m-5 h-60 animate-pulse rounded-2xl bg-cream" />
            ) : (
              <form key={bank.iban} onSubmit={saveBank}>
                <fieldset disabled={readOnly} className="grid min-w-0 gap-4 p-5">
                  <p className="rounded-2xl bg-cream/70 p-4 text-[13px] leading-relaxed text-ink/70">{t.payoutAccountNote}</p>
                  <Field label={t.accountHolder} name="accountHolder" required defaultValue={bank.accountHolder} />
                  <Field label={t.bank} name="bankName" required defaultValue={bank.bankName} />
                  <Field label={t.iban} name="iban" dir="ltr" required placeholder="SA00 0000 0000 0000 0000 0000" defaultValue={bank.iban} />
                  {!readOnly && <Button type="submit" className="w-full justify-between">{t.saveBank}</Button>}
                </fieldset>
              </form>
            )}
          </Panel>

          {(contact.crNumber || contact.vatNumber || contact.email) && (
            <Panel title={t.businessDetails}>
              <dl className="grid gap-3 p-5 text-sm sm:grid-cols-3">
                {(
                  [
                    [admin.contactEmail, contact.email],
                    [admin.crNo, contact.crNumber],
                    [admin.vatNo, contact.vatNumber],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
                      <dd dir="ltr" className="font-mono text-[13px]">{value}</dd>
                    </div>
                  ))}
              </dl>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
