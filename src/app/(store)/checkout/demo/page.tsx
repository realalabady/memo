"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { QuarterRing } from "@/components/store/installments";
import { Bezel, Button, Eyebrow, ProviderChip } from "@/components/ui/primitives";
import { useAuthedFetch } from "@/lib/auth/auth-provider";
import { formatSAR, installment } from "@/lib/utils";

/** Stand-in for the Tabby/Tamara hosted page while keys aren't configured. */
function Simulator() {
  const params = useSearchParams();
  const router = useRouter();
  const authedFetch = useAuthedFetch();
  const provider = params.get("provider") === "tamara" ? "tamara" : "tabby";
  const amount = Number(params.get("amount") ?? 0);
  const order = params.get("order") ?? "demo";
  const [busy, setBusy] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    const res = await authedFetch("/api/payments/demo", { method: "POST", body: JSON.stringify({ orderId: order, approve }) });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? "Simulator error");
      setBusy(false);
      return;
    }
    router.replace(`/checkout/result?order=${order}&status=${body.status}`);
  }

  return (
    <section className="flex min-h-[100dvh] items-center justify-center px-4 pt-24">
      <Bezel className="w-full max-w-md" innerClassName="p-8 text-center">
        <Eyebrow>Payment simulator</Eyebrow>
        <div className="mt-6 flex justify-center">
          <ProviderChip provider={provider} className="px-4 py-1.5 text-base" />
        </div>
        <p className="font-display mt-6 text-5xl">{formatSAR(amount)}</p>
        <p className="mt-2 text-sm text-muted">4 × {formatSAR(installment(amount), { decimals: true })}</p>
        <div className="my-8 flex justify-center">
          <QuarterRing paid={1} className="size-16" />
        </div>
        <p className="mb-6 text-xs text-muted">
          This screen replaces the {provider} hosted checkout until your API keys are set. Approving records the order
          exactly like a real {provider} payment.
        </p>
        <div className="grid gap-2">
          <Button onClick={() => decide(true)} disabled={busy} className="w-full justify-between">
            Approve payment
          </Button>
          <Button variant="ghost" trailing={false} onClick={() => decide(false)} disabled={busy} className="w-full">
            Cancel
          </Button>
        </div>
      </Bezel>
    </section>
  );
}

export default function DemoPaymentPage() {
  return (
    <Suspense>
      <Simulator />
    </Suspense>
  );
}
