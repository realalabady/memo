"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, Field, TextArea } from "@/components/ui/primitives";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { useMerchantBank } from "@/lib/data/hooks";
import { saveMerchantBank, updateMerchantProfile, uploadImage } from "@/lib/data/mutations";

export default function MerchantSettings() {
  const { user, merchant } = useAuth();
  const authedFetch = useAuthedFetch();
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
      await authedFetch("/api/revalidate", { method: "POST" });
      toast("Store updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function saveBank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const iban = String(f.get("iban")).replace(/\s+/g, "").toUpperCase();
    if (!/^SA\d{22}$/.test(iban)) return toast.error("Enter a valid Saudi IBAN (SA + 22 digits)");
    try {
      await saveMerchantBank(user.uid, {
        accountHolder: String(f.get("accountHolder")),
        bankName: String(f.get("bankName")),
        iban,
      });
      toast("Bank details saved");
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
      <PageHeader eyebrow="Settings" title={<>Your <span className="italic">store</span></>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Storefront">
          <form onSubmit={saveProfile} className="grid gap-4 p-5">
            <label className="flex cursor-pointer items-center gap-4">
              <span className="relative size-16 overflow-hidden rounded-full bg-sand ring-1 ring-ink/10">
                {logoUrl && <Image src={logoUrl} alt="" fill sizes="64px" className="object-cover" />}
              </span>
              <span className="text-sm text-muted underline underline-offset-4">Change logo</span>
              <input type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
            </label>
            <Field label="Store name" name="storeName" required defaultValue={merchant?.storeName} />
            <Field label="Tagline" name="tagline" defaultValue={merchant?.tagline} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" name="city" defaultValue={merchant?.city} />
              <Field label="Mobile" name="phone" defaultValue={merchant?.phone} />
            </div>
            <TextArea label="About" name="bio" defaultValue={merchant?.bio} />
            <Button type="submit" className="w-full justify-between">Save storefront</Button>
          </form>
        </Panel>

        <Panel title="Payout account">
          {loading ? (
            <div className="m-5 h-60 animate-pulse rounded-2xl bg-cream" />
          ) : (
            <form key={bank.iban} onSubmit={saveBank} className="grid gap-4 p-5">
              <p className="rounded-2xl bg-cream/70 p-4 text-[13px] leading-relaxed text-ink/70">
                Customers pay through memo&apos;s Tabby and Tamara accounts. memo transfers your share to this IBAN and records each transfer under <span className="font-medium">Payouts</span>. Only you and memo admins can see these details.
              </p>
              <Field label="Account holder" name="accountHolder" required defaultValue={bank.accountHolder} />
              <Field label="Bank" name="bankName" required defaultValue={bank.bankName} />
              <Field label="IBAN" name="iban" required placeholder="SA00 0000 0000 0000 0000 0000" defaultValue={bank.iban} />
              <Button type="submit" className="w-full justify-between">Save bank details</Button>
            </form>
          )}
        </Panel>
      </div>
    </>
  );
}
