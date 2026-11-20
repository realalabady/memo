import type { MerchantOrder } from "@/lib/types";

/** Transactions export, shared by the server CSV route and the demo-mode download. */
export const TX_CSV_HEAD = ["date", "order", "customer", "email", "phone", "items", "merchant", "provider", "payment", "sale", "vat", "commission", "bnpl_fee", "merchant_payout", "payout_status"];

const esc = (v: string | number | undefined) => {
  let s = String(v ?? "");
  // Stop spreadsheet apps from running a cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function txCsvLine(r: MerchantOrder) {
  return [
    new Date(r.createdAt).toISOString(),
    r.orderId,
    `${r.customer.firstName} ${r.customer.lastName}`,
    r.customer.email,
    r.customer.phone,
    r.items.map((i) => `${i.title} x${i.quantity}`).join("; "),
    r.merchantName,
    r.provider,
    r.paymentStatus,
    r.subtotal,
    r.vatAmount ?? "",
    r.commission,
    r.providerFee,
    r.payoutAmount,
    r.payoutStatus,
  ]
    .map(esc)
    .join(",");
}

export interface TxFilter {
  q?: string;
  provider?: "all" | "tabby" | "tamara";
  payout?: "all" | "unpaid" | "paid";
}

export function matchesTx(r: MerchantOrder, { q = "", provider = "all", payout = "all" }: TxFilter) {
  const s = q.trim().toLowerCase();
  return (
    (provider === "all" || r.provider === provider) &&
    (payout === "all" || (r.paymentStatus === "captured" && r.payoutStatus === payout)) &&
    (!s ||
      [r.orderId, r.merchantName, r.customer.firstName, r.customer.lastName, r.customer.email, ...r.items.flatMap((i) => [i.title, i.titleAr ?? ""])]
        .join(" ")
        .toLowerCase()
        .includes(s))
  );
}

export function toTxCsv(rows: MerchantOrder[]) {
  return [TX_CSV_HEAD.join(","), ...rows.map(txCsvLine)].join("\n");
}
