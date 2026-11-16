import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/merchant";
import { bankInput } from "@/lib/server/schemas";

/** Save payout bank details (owner only). Every change is audited — a swapped IBAN is a classic takeover fraud. */
export async function PUT(req: Request) {
  try {
    const user = await requireUser(req);
    const db = adminDb();
    const merchant = await db.collection("merchants").doc(user.uid).get();
    if (!merchant.exists) throw new HttpError(403, "You don't have a store yet");

    const parsed = bankInput.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid bank details");

    const ref = db.collection("merchants").doc(user.uid).collection("private").doc("bank");
    const before = await ref.get();
    await ref.set({ ...parsed.data, updatedAt: Date.now() });
    await audit(user.uid, "merchant.bank.update", `merchants/${user.uid}`, {
      previousIbanLast4: (before.data()?.iban as string | undefined)?.slice(-4) ?? null,
      ibanLast4: parsed.data.iban.slice(-4),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
