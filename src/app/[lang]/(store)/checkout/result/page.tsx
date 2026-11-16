"use client";

import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { QuarterRing } from "@/components/store/installments";
import { expo } from "@/components/ui/motion";
import { ButtonLink } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/store/cart";
import type { PaymentStatus } from "@/lib/types";
import { shortId } from "@/lib/utils";

type View = "loading" | "captured" | "processing" | "cancelled" | "failed";

/**
 * Never trusts the URL for the outcome: it loads the order's real payment status from
 * the server (polling briefly while the provider confirms). Only the sample-data demo
 * (order=demo, no database) uses the `status` query value.
 */
function useOrderStatus(order: string, demoStatus: string | null): View {
  const { user, loading } = useAuth();
  const authedFetch = useAuthedFetch();
  const [view, setView] = useState<View>("loading");
  const demoView: View | null =
    order === "demo" ? (demoStatus === "captured" ? "captured" : demoStatus === "cancelled" ? "cancelled" : "failed") : null;

  useEffect(() => {
    if (order === "demo" || loading) return;
    let stop = false;
    (async () => {
      if (!user || !order) return setView("failed");
      for (let attempt = 0; attempt < 10 && !stop; attempt++) {
        const res = await authedFetch(`/api/orders/${encodeURIComponent(order)}`);
        if (!res.ok) break;
        const { paymentStatus } = (await res.json()) as { paymentStatus: PaymentStatus };
        if (paymentStatus === "captured") return setView("captured");
        if (paymentStatus === "cancelled") return setView("cancelled");
        if (paymentStatus === "failed" || paymentStatus === "refunded") return setView("failed");
        setView("processing");
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stop) setView((v) => (v === "loading" ? "failed" : v));
    })();
    return () => {
      stop = true;
    };
  }, [order, user, loading, authedFetch]);

  return demoView ?? view;
}

function Result() {
  const t = useT().result;
  const params = useSearchParams();
  const order = params.get("order") ?? "";
  const view = useOrderStatus(order, params.get("status"));
  const clear = useCart((s) => s.clear);
  const ok = view === "captured";

  useEffect(() => {
    if (ok) clear();
  }, [ok, clear]);

  const heading =
    view === "captured" ? (
      <>
        {t.yours} <span className="italic text-ember">{t.yoursEm}</span>
      </>
    ) : view === "loading" || view === "processing" ? (
      <>{t.confirming}</>
    ) : view === "cancelled" ? (
      <>{t.cancelled}</>
    ) : (
      <>{t.notCompleted}</>
    );

  const body =
    view === "captured"
      ? fmt(t.confirmedBody, { id: shortId(order) })
      : view === "loading" || view === "processing"
        ? t.waitingBody
        : t.failedBody;

  return (
    <section className="flex min-h-[90dvh] flex-col items-center justify-center px-4 pt-28 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ duration: 1.2, ease: expo }}>
        <QuarterRing paid={ok ? 4 : view === "processing" || view === "loading" ? 2 : 1} className="size-24" />
      </motion.div>
      <h1 className="font-display mt-10 text-6xl leading-[0.92] md:text-8xl">{heading}</h1>
      <p className="mt-6 max-w-md text-ink/60">{body}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {ok || view === "processing" ? (
          <ButtonLink href="/account">{t.viewOrders}</ButtonLink>
        ) : view === "loading" ? null : (
          <ButtonLink href="/checkout">{t.backToCheckout}</ButtonLink>
        )}
        <ButtonLink href="/shop" variant="paper">
          {t.keepShopping}
        </ButtonLink>
      </div>
    </section>
  );
}

export default function ResultPage() {
  return (
    <Suspense>
      <Result />
    </Suspense>
  );
}
