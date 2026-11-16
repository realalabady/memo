"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field, TextArea } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useMerchantBank } from "@/lib/data/hooks";
import { saveMerchantBank, updateMerchantProfile, uploadImage } from "@/lib/data/mutations";

export default function MerchantSettings() {
  const t = useT().merchant;
  const { user, merchant } = useAuth();
  const { data: bank, loading } = useMerchantBank(user?.uid ?? null);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const logoUrl = logo ?? merchant?.logoUrl;

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    try {
      await updateMerchantProfile(user.uid, {
        storeName: String(f.get("storeName")),
        tagline: String(f.get("tagline")),
        bio: String(f.get("bio")),
        city: String(f.get("city")),
        phone: String(f.get("phone")),
        ...(logoUrl ? { logoUrl } : {}),
      });
      toast(t.storeUpdated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function saveBank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const iban = String(f.get("iban")).replace(/\s+/g, "").toUpperCase();
    if (!/^SA\d{22}$/.test(iban)) return toast.error(t.ibanInvalid);
    try {
      await saveMerchantBank(user.uid, {
        accountHolder: String(f.get("accountHolder")),
        bankName: String(f.get("bankName")),
        iban,
      });
      toast(t.bankSaved);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onLogo(file?: File) {
    if (!file || !user) return;
    try {
      setLogo(await uploadImage(`merchants/${user.uid}`, file));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={t.settingsEyebrow} title={<>{t.settingsTitle} <span className="italic">{t.settingsEm}</span></>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={t.storefront}>
          {/* keyed on the merchant so the uncontrolled fields refill once the store doc loads */}
          <form key={merchant?.id ?? "loading"} onSubmit={saveProfile} className="grid gap-4 p-5">
            <label className="flex cursor-pointer items-center gap-4">
              <span className="relative size-16 overflow-hidden rounded-full bg-sand ring-1 ring-ink/10">
                {logoUrl && <Image src={logoUrl} alt="" fill sizes="64px" className="object-cover" />}
              </span>
              <span className="text-sm text-muted underline underline-offset-4">{t.changeLogo}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
            </label>
            <Field label={t.storeName} name="storeName" required defaultValue={merchant?.storeName} />
            <Field label={t.tagline} name="tagline" defaultValue={merchant?.tagline} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.city} name="city" defaultValue={merchant?.city} />
              <Field label={t.mobile} name="phone" dir="ltr" defaultValue={merchant?.phone} />
            </div>
            <TextArea label={t.about} name="bio" defaultValue={merchant?.bio} />
            <Button type="submit" disabled={!merchant} className="w-full justify-between">{t.saveStorefront}</Button>
          </form>
        </Panel>

        <Panel title={t.payoutAccount}>
          {loading ? (
            <div className="m-5 h-60 animate-pulse rounded-2xl bg-cream" />
          ) : (
            <form key={bank.iban} onSubmit={saveBank} className="grid gap-4 p-5">
              <p className="rounded-2xl bg-cream/70 p-4 text-[13px] leading-relaxed text-ink/70">{t.payoutAccountNote}</p>
              <Field label={t.accountHolder} name="accountHolder" required defaultValue={bank.accountHolder} />
              <Field label={t.bank} name="bankName" required defaultValue={bank.bankName} />
              <Field label={t.iban} name="iban" dir="ltr" required placeholder="SA00 0000 0000 0000 0000 0000" defaultValue={bank.iban} />
              <Button type="submit" className="w-full justify-between">{t.saveBank}</Button>
            </form>
          )}
        </Panel>
      </div>
    </>
  );
}
