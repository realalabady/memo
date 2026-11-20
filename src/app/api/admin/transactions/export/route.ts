import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { matchesTx, TX_CSV_HEAD, txCsvLine, type TxFilter } from "@/lib/csv";
import { errorResponse, requireUser } from "@/lib/server/auth";
import type { MerchantOrder } from "@/lib/types";

const PAGE = 500;

/** Admin: every ledger row as CSV (the dashboard list only holds the newest 1,000). Same filters as the page. */
export async function GET(req: Request) {
  await connection(); // per-request data, never prerendered (outside try: Next uses its rejection)
  try {
    await requireUser(req, ["admin"]);
    const params = new URL(req.url).searchParams;
    const filter: TxFilter = {
      q: params.get("q") ?? "",
      provider: (["tabby", "tamara"].includes(params.get("provider") ?? "") ? params.get("provider") : "all") as TxFilter["provider"],
      payout: (["unpaid", "paid"].includes(params.get("payout") ?? "") ? params.get("payout") : "all") as TxFilter["payout"],
    };
    const base = adminDb().collection("merchantOrders").orderBy("createdAt", "desc");
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`﻿${TX_CSV_HEAD.join(",")}\n`)); // BOM so Excel reads Arabic
          let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
          for (;;) {
            const snap = await (cursor ? base.startAfter(cursor) : base).limit(PAGE).get();
            const lines = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as MerchantOrder)
              .filter((r) => matchesTx(r, filter))
              .map((r) => `${txCsvLine(r)}\n`);
            if (lines.length) controller.enqueue(encoder.encode(lines.join("")));
            if (snap.size < PAGE) break;
            cursor = snap.docs[snap.docs.length - 1];
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="memo-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
