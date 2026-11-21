"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Bezel, Button, Eyebrow, Field, ProviderChip, StatusPill } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/motion";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAddresses, useCustomerOrders } from "@/lib/data/hooks";
import { friendlyError, useFormErrors } from "@/lib/form-errors";
import { deleteAddress, saveAddress, updateOwnProfile } from "@/lib/data/mutations";
import { shortId } from "@/lib/utils";

export default function AccountPage() {
  const t = useT().account;
  const common = useT().common;
  const checkout = useT().checkout;
  const invoiceT = useT().invoice;
  const wishlistT = useT().wishlist;
  const { money, date, lang } = useFormat();
  const { user, profile, merchant, loading, demo, signOut } = useAuth();
  const router = useRouter();
  const { data: orders, loading: ordersLoading } = useCustomerOrders(user?.uid ?? null);
  const { data: addresses } = useAddresses(demo ? null : (user?.uid ?? null));
  const [adding, setAdding] = useState(false);
  const validation = useT().validation;
  const addressForm = useFormErrors();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/account");
  }, [loading, user, router]);

  if (!user) return <div className="min-h-[100dvh]" />;

  async function run(fn: () => Promise<void>, done: string) {
    try {
      await fn();
      toast(done);
    } catch (err) {
      toast.error(friendlyError(err, validation, common.somethingWrong));
    }
  }

  function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() => updateOwnProfile(user!.uid, { displayName: String(f.get("displayName")), phone: String(f.get("phone") ?? "") }), t.profileSaved);
  }

  function addAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addressForm.validate(e.currentTarget)) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    run(async () => {
      await saveAddress(user!.uid, {
        firstName: get("firstName"),
        lastName: get("lastName"),
        email: user!.email,
        phone: get("phone"),
        city: get("city"),
        line1: get("line1"),
        zip: get("zip"),
        nationalAddress: get("nationalAddress").trim().toUpperCase(),
        label: get("label"),
      });
      setAdding(false);
    }, t.addressSaved);
  }

  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <div className="mx-auto max-w-4xl">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h1 className="font-display mt-6 text-6xl leading-[0.92]">
              {t.hi} <span className="italic">{profile?.displayName?.split(" ")[0] || t.there}.</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile?.role === "admin" && <Link href="/admin" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">{t.admin}</Link>}
            {profile?.role === "merchant" && <Link href="/merchant" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">{t.merchantHub}</Link>}
            {!merchant && profile?.role === "customer" && <Link href="/sell" className="rounded-full px-4 py-2 text-sm ring-1 ring-ink/10">{t.openStore}</Link>}
            {merchant?.status === "pending" && <span className="rounded-full bg-sand px-4 py-2 text-sm">{t.underReview}</span>}
            <Link href="/account/wishlist" className="rounded-full px-4 py-2 text-sm ring-1 ring-ink/10">{wishlistT.link}</Link>
            <Button size="sm" variant="ghost" onClick={() => signOut()}>{common.signOut}</Button>
          </div>
        </Reveal>

        <h2 className="font-display mb-6 mt-16 text-3xl italic">{t.yourOrders}</h2>
        {ordersLoading ? (
          <div className="h-40 animate-pulse rounded-[2rem] bg-cream" />
        ) : orders.length === 0 ? (
          <p className="rounded-[2rem] bg-cream/60 p-10 text-center text-muted">{t.noOrders}</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <Bezel key={o.id} innerClassName="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted">#{shortId(o.id)}</span>
                    <span className="text-sm text-muted">{date(o.createdAt)}</span>
                    {o.provider !== "demo" && <ProviderChip provider={o.provider} />}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPill status={o.paymentStatus} />
                    <Link href={`/account/orders/${o.id}`} className="text-xs text-ink/60 underline underline-offset-4 hover:text-ink">
                      {t.viewOrder}
                    </Link>
                    {(o.paymentStatus === "captured" || o.paymentStatus === "refunded") && (
                      <Link href={`/account/orders/${o.id}/invoice`} className="text-xs text-ink/60 underline underline-offset-4 hover:text-ink">
                        {invoiceT.link}
                      </Link>
                    )}
                    <span className="font-medium tabular-nums">{money(o.total)}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto">
                  {o.items.map((i) => (
                    <div key={i.productId} className="flex shrink-0 items-center gap-2 rounded-2xl bg-cream/60 p-1.5 pe-3">
                      <div className="relative size-10 overflow-hidden rounded-xl bg-sand">
                        {i.image && <Image src={i.image} alt="" fill sizes="40px" className="object-cover" />}
                      </div>
                      <span className="text-xs">{localized(i, "title", lang)} × {i.quantity}</span>
                    </div>
                  ))}
                </div>
              </Bezel>
            ))}
          </div>
        )}

        {!demo && (
          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="font-display mb-6 text-3xl italic">{t.profile}</h2>
              <Bezel innerClassName="p-5">
                <form key={profile?.uid ?? "loading"} onSubmit={saveProfile} className="space-y-4">
                  <Field label={t.name} name="displayName" required maxLength={80} defaultValue={profile?.displayName} autoComplete="name" />
                  <Field label={t.phone} name="phone" type="tel" dir="ltr" maxLength={20} defaultValue={profile?.phone} placeholder="+9665XXXXXXXX" autoComplete="tel" />
                  <p className="text-xs text-muted" dir="ltr">{user.email}</p>
                  <Button type="submit" size="sm" trailing={false}>{t.saveProfile}</Button>
                </form>
              </Bezel>
            </div>

            <div>
              <h2 className="font-display mb-6 text-3xl italic">{t.addresses}</h2>
              <div className="space-y-3">
                {addresses.length === 0 && !adding && <p className="rounded-[2rem] bg-cream/60 p-6 text-center text-sm text-muted">{t.noAddresses}</p>}
                {addresses.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 rounded-3xl p-4 ring-1 ring-ink/[0.06]">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{a.label || `${a.firstName} ${a.lastName}`}</p>
                      <p className="text-muted">{a.line1}, {a.city}{a.zip ? ` ${a.zip}` : ""}</p>
                      {a.nationalAddress && <p className="text-muted">{checkout.nationalAddress}: <span dir="ltr">{a.nationalAddress}</span></p>}
                      <p className="text-muted" dir="ltr">{a.phone}</p>
                    </div>
                    <button onClick={() => run(() => deleteAddress(user.uid, a.id), t.addressDeleted)} className="shrink-0 text-xs text-muted underline-offset-2 hover:text-ember hover:underline">
                      {common.remove}
                    </button>
                  </div>
                ))}
                {adding ? (
                  <Bezel innerClassName="p-5">
                    <form onSubmit={addAddress} onInput={addressForm.clear} noValidate className="grid gap-3 sm:grid-cols-2">
                      <Field className="sm:col-span-2" label={t.addressLabel} name="label" maxLength={40} error={addressForm.errors.label} />
                      <Field label={checkout.firstName} name="firstName" required maxLength={60} autoComplete="given-name" error={addressForm.errors.firstName} />
                      <Field label={checkout.lastName} name="lastName" required maxLength={60} autoComplete="family-name" error={addressForm.errors.lastName} />
                      <Field label={checkout.mobile} name="phone" type="tel" dir="ltr" required minLength={8} maxLength={20} placeholder="+9665XXXXXXXX" autoComplete="tel" error={addressForm.errors.phone} />
                      <Field label={checkout.city} name="city" required maxLength={60} autoComplete="address-level2" error={addressForm.errors.city} />
                      <Field className="sm:col-span-2" label={checkout.street} name="line1" required minLength={3} maxLength={200} autoComplete="street-address" error={addressForm.errors.line1} />
                      <Field label={checkout.nationalAddress} name="nationalAddress" dir="ltr" maxLength={8} pattern="[A-Za-z]{4}[0-9]{4}" title={checkout.nationalAddressHint} placeholder="RRRD2929" autoCapitalize="characters" style={{ textTransform: "uppercase" }} error={addressForm.errors.nationalAddress} />
                      <Field label={checkout.zip} name="zip" dir="ltr" maxLength={10} autoComplete="postal-code" error={addressForm.errors.zip} />
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Button type="submit" size="sm" trailing={false}>{common.save}</Button>
                        <button type="button" onClick={() => { setAdding(false); addressForm.reset(); }} className="px-3 py-2 text-xs text-muted">{common.cancel}</button>
                      </div>
                    </form>
                  </Bezel>
                ) : (
                  <button onClick={() => setAdding(true)} className="w-full rounded-3xl border border-dashed border-ink/15 p-4 text-sm text-muted transition hover:bg-cream">
                    {t.addAddress}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
