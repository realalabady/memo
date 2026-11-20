"use client";

import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Star } from "@phosphor-icons/react";
import { StarRow } from "@/components/store/stars";
import { Button, TextArea } from "@/components/ui/primitives";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { db } from "@/lib/firebase/client";
import type { Review } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Reviews on the product page. `reviews` are the visible ones rendered by the server.
 * Signed-in buyers get the form (the server re-checks the purchase); admins also see hidden reviews and can hide/show.
 */
export function Reviews({ productId, reviews, avg, count }: { productId: string; reviews: Review[]; avg?: number; count?: number }) {
  const t = useT().reviews;
  const { date } = useFormat();
  const { user, profile, demo } = useAuth();
  const authedFetch = useAuthedFetch();
  const router = useRouter();
  const live = Boolean(user) && !demo;
  const isAdmin = live && profile?.role === "admin";

  const [mine, setMine] = useState<{ eligible: boolean; review: Review | null } | null>(null);
  const [all, setAll] = useState<Review[] | null>(null); // admin view, includes hidden
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);

  const loadAdmin = useCallback(async () => {
    const snap = await getDocs(collection(db(), "products", productId, "reviews"));
    setAll(snap.docs.map((d) => d.data() as Review).sort((a, b) => b.createdAt - a.createdAt));
  }, [productId]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    authedFetch(`/api/reviews?productId=${encodeURIComponent(productId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { eligible: boolean; review: Review | null } | null) => {
        if (cancelled || !body) return;
        setMine(body);
        setRating(body.review?.rating ?? 0);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after it resolves
    if (isAdmin) loadAdmin().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [live, isAdmin, productId, authedFetch, loadAdmin]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rating) return toast.error(t.rating);
    const text = String(new FormData(e.currentTarget).get("text") ?? "");
    setBusy(true);
    try {
      const res = await authedFetch("/api/reviews", { method: "POST", body: JSON.stringify({ productId, rating, text }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setMine({ eligible: true, review: body.review });
      toast(t.thanks);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function moderate(r: Review) {
    try {
      const res = await authedFetch("/api/reviews", {
        method: "PATCH",
        body: JSON.stringify({ productId, reviewUid: r.uid, hidden: !r.hidden }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await loadAdmin();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const list = all ?? reviews;

  return (
    <section id="reviews" className="mt-24 scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-4xl md:text-5xl">{t.title}</h2>
        {count ? (
          <p className="flex items-center gap-3 text-sm text-muted">
            <StarRow value={avg ?? 0} />
            <span className="tabular-nums text-ink">{(avg ?? 0).toFixed(1)}</span>
            <span>{fmt(t.count, { n: count })}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <ul className="space-y-4 lg:col-span-7">
          {list.length === 0 && <li className="rounded-[1.75rem] bg-cream/60 p-8 text-center text-muted">{t.none}</li>}
          {list.map((r) => (
            <li key={r.uid} className={cn("rounded-[1.75rem] p-5 ring-1 ring-ink/[0.06]", r.hidden && "opacity-60")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <StarRow value={r.rating} />
                  <span className="text-sm font-medium">{r.displayName}</span>
                  <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] text-[#4c5a3f]">{t.verified}</span>
                  {r.hidden && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-paper">{t.hidden}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{date(r.updatedAt ?? r.createdAt)}</span>
                  {isAdmin && (
                    <button onClick={() => moderate(r)} className="rounded-full px-3 py-1 ring-1 ring-ink/10 hover:text-ink">
                      {r.hidden ? t.unhide : t.hide}
                    </button>
                  )}
                </div>
              </div>
              {r.text && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/75">{r.text}</p>}
              {r.reply?.text && (
                <div className="mt-4 rounded-2xl bg-cream/70 p-4 text-sm">
                  <p className="text-[11px] font-medium text-muted">{t.storeReply}</p>
                  <p className="mt-1 whitespace-pre-line text-ink/75">{r.reply.text}</p>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="lg:col-span-5">
          <div className="rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06] lg:sticky lg:top-32">
            <div className="rounded-[calc(1.75rem-0.375rem)] bg-paper p-6 shadow-[var(--shadow-inset)]">
              {!user || demo ? (
                <div className="text-center">
                  <p className="text-sm text-muted">{t.buyersOnly}</p>
                  {!user && (
                    <Link href={`/login?next=${encodeURIComponent(`/product/${productId}`)}`} className="mt-4 inline-block text-sm underline underline-offset-4">
                      {t.signIn}
                    </Link>
                  )}
                </div>
              ) : mine === null ? (
                <div className="h-40 animate-pulse rounded-2xl bg-cream" />
              ) : !mine.eligible ? (
                <p className="text-center text-sm text-muted">{t.buyersOnly}</p>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <p className="font-display text-2xl italic">{mine.review ? t.edit : t.write}</p>
                  <div role="radiogroup" aria-label={t.rating} className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={rating === n}
                        aria-label={fmt(t.stars, { n })}
                        onClick={() => setRating(n)}
                        className="rounded-full p-1.5 transition hover:scale-110"
                      >
                        <Star weight={n <= rating ? "fill" : "light"} className={cn("size-7", n <= rating ? "text-ember" : "text-ink/30")} />
                      </button>
                    ))}
                  </div>
                  <TextArea label={t.title} name="text" maxLength={1500} placeholder={t.placeholder} defaultValue={mine.review?.text} />
                  <Button type="submit" disabled={busy} className="w-full justify-between">
                    {t.submit}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
