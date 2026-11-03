"use client";

import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { QuarterRing } from "@/components/store/installments";
import { expo } from "@/components/ui/motion";
import { ButtonLink } from "@/components/ui/primitives";
import { useCart } from "@/lib/store/cart";
import { shortId } from "@/lib/utils";

function Result() {
  const params = useSearchParams();
  const status = params.get("status");
  const order = params.get("order") ?? "";
  const clear = useCart((s) => s.clear);
  const ok = status === "captured";

  useEffect(() => {
    if (ok) clear();
  }, [ok, clear]);

  return (
    <section className="flex min-h-[90dvh] flex-col items-center justify-center px-4 pt-28 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ duration: 1.2, ease: expo }}>
        <QuarterRing paid={ok ? 4 : 1} className="size-24" />
      </motion.div>
      <h1 className="font-display mt-10 text-6xl leading-[0.92] md:text-8xl">
        {ok ? (
          <>
            It&apos;s <span className="italic text-ember">yours.</span>
          </>
        ) : status === "cancelled" ? (
          <>Payment cancelled.</>
        ) : (
          <>Payment not completed.</>
        )}
      </h1>
      <p className="mt-6 max-w-md text-ink/60">
        {ok
          ? `Order ${shortId(order)} is confirmed. The stores have been notified and your first installment is done.`
          : "Nothing was charged. Your bag is still saved — you can try again or pick the other provider."}
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {ok ? (
          <ButtonLink href="/account">View my orders</ButtonLink>
        ) : (
          <ButtonLink href="/checkout">Back to checkout</ButtonLink>
        )}
        <ButtonLink href="/shop" variant="paper">
          Keep shopping
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
