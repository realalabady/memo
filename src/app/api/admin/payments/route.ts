import { FieldValue } from "firebase-admin/firestore";
import { connection } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { appUrl, errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/merchant";
import {
  getPaymentKeys,
  invalidatePaymentConfig,
  keySources,
  mask,
  secretsRef,
  TABBY_API_DEFAULT,
  TAMARA_PRODUCTION,
  TAMARA_SANDBOX,
} from "@/lib/server/payment-config";
import { getSettings } from "@/lib/server/orders";

/** Changing where payments go is the most sensitive admin action: require a sign-in from the last 10 minutes. */
const RECENT_LOGIN_SECONDS = 10 * 60;

const key = z.string().trim().max(500);
const schema = z.object({
  tabby: z
    .object({
      secretKey: key.refine((v) => v === "" || /^sk_[A-Za-z0-9_-]{8,}$/.test(v), "Tabby secret keys start with sk_").optional(),
      merchantCode: key.refine((v) => v === "" || /^[A-Za-z0-9_-]{2,64}$/.test(v), "Check the merchant code").optional(),
      // Only Tabby's own API host: a saved key must never be sent anywhere else.
      apiUrl: z.enum([TABBY_API_DEFAULT]).optional(),
      webhookSecret: key.refine((v) => v === "" || v.length >= 16, "Use at least 16 characters").optional(),
    })
    .optional(),
  tamara: z
    .object({
      apiToken: key.optional(),
      apiUrl: z.enum([TAMARA_SANDBOX, TAMARA_PRODUCTION]).optional(),
      notificationToken: key.optional(),
    })
    .optional(),
  /** Fields to remove (falls back to the server environment variable, if any) */
  clear: z
    .array(z.enum(["tabby.secretKey", "tabby.merchantCode", "tabby.webhookSecret", "tamara.apiToken", "tamara.notificationToken", "tamara.apiUrl"]))
    .max(10)
    .optional(),
  tabbyEnabled: z.boolean().optional(),
  tamaraEnabled: z.boolean().optional(),
});

/** Admin: current payment setup with every secret masked. */
export async function GET(req: Request) {
  await connection(); // per-request, never prerendered
  try {
    await requireUser(req, ["admin"]);
    const [k, sources, settings] = await Promise.all([getPaymentKeys(), keySources(), getSettings()]);
    const base = appUrl();
    return Response.json(
      {
        tabby: {
          secretKey: mask(k.tabby.secretKey),
          merchantCode: k.tabby.merchantCode,
          apiUrl: k.tabby.apiUrl,
          webhookSecret: mask(k.tabby.webhookSecret),
          testMode: k.tabby.secretKey.startsWith("sk_test"),
          configured: Boolean(k.tabby.secretKey && k.tabby.merchantCode),
          enabled: settings.tabbyEnabled !== false,
          webhookUrl: `${base}/api/webhooks/tabby`,
        },
        tamara: {
          apiToken: mask(k.tamara.apiToken),
          apiUrl: k.tamara.apiUrl,
          notificationToken: mask(k.tamara.notificationToken),
          testMode: k.tamara.apiUrl === TAMARA_SANDBOX,
          configured: Boolean(k.tamara.apiToken),
          enabled: settings.tamaraEnabled !== false,
          webhookUrl: `${base}/api/webhooks/tamara`,
        },
        sources,
        publicHttps: base.startsWith("https://"),
        simulator: process.env.NODE_ENV !== "production",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** Admin: save keys (blank = keep the current value), clear fields, switch providers on/off. */
export async function PUT(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid payment settings");
    const { tabby, tamara, clear = [], tabbyEnabled, tamaraEnabled } = parsed.data;

    const stored = ((await secretsRef().get()).data() ?? {}) as Record<string, Record<string, string> | undefined>;
    const effective = (await getPaymentKeys()) as unknown as Record<string, Record<string, string>>;
    const update: Record<string, unknown> = {};
    for (const [provider, fields] of [
      ["tabby", tabby],
      ["tamara", tamara],
    ] as const) {
      for (const [field, value] of Object.entries(fields ?? {})) {
        // Blank keeps the current value; resending the same value is not a change.
        if (typeof value === "string" && value !== "" && effective[provider]?.[field] !== value) update[`${provider}.${field}`] = value;
      }
    }
    for (const path of clear) {
      const [provider, field] = path.split(".");
      if (stored[provider]?.[field] !== undefined) update[path] = FieldValue.delete();
    }
    const keysChanged = Object.keys(update);

    if (keysChanged.length) {
      const authTime = Number(admin.decoded.auth_time ?? 0);
      if (Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
        throw new HttpError(401, "For security, sign out and sign in again, then save the payment keys within 10 minutes.");
      }
      await secretsRef().set({ updatedAt: Date.now(), updatedBy: admin.uid }, { merge: true });
      await secretsRef().update({ ...update, updatedAt: Date.now() });
      invalidatePaymentConfig();
    }
    if (tabbyEnabled !== undefined || tamaraEnabled !== undefined) {
      await adminDb()
        .collection("settings")
        .doc("platform")
        .set({ ...(tabbyEnabled !== undefined ? { tabbyEnabled } : {}), ...(tamaraEnabled !== undefined ? { tamaraEnabled } : {}) }, { merge: true });
    }
    // Field names only: secret values never go into the audit log.
    await audit(admin.uid, "admin.payments.update", "secrets/payments", { fields: keysChanged, tabbyEnabled, tamaraEnabled });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
