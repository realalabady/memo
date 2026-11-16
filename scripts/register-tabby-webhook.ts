/**
 * Registers (or lists) the Tabby webhook for this deployment.
 *
 *   npx tsx --env-file=.env.local scripts/register-tabby-webhook.ts          # register
 *   npx tsx --env-file=.env.local scripts/register-tabby-webhook.ts --list   # show existing
 *
 * Needs TABBY_SECRET_KEY, TABBY_MERCHANT_CODE, TABBY_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL
 * (a public https URL — Tabby cannot reach localhost).
 */
const api = (process.env.TABBY_API_URL ?? "https://api.tabby.ai").replace(/\/$/, "");
const key = process.env.TABBY_SECRET_KEY;
const merchantCode = process.env.TABBY_MERCHANT_CODE;
const secret = process.env.TABBY_WEBHOOK_SECRET;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

async function main() {
  if (!key || !merchantCode) throw new Error("Set TABBY_SECRET_KEY and TABBY_MERCHANT_CODE");
  const headers = {
    Authorization: `Bearer ${key}`,
    "X-Merchant-Code": merchantCode,
    "Content-Type": "application/json",
  };

  if (process.argv.includes("--list")) {
    const res = await fetch(`${api}/api/v1/webhooks`, { headers });
    console.log(res.status, JSON.stringify(await res.json().catch(() => ({})), null, 2));
    return;
  }

  if (!secret) throw new Error("Set TABBY_WEBHOOK_SECRET (any long random string)");
  if (!appUrl.startsWith("https://")) throw new Error("NEXT_PUBLIC_APP_URL must be a public https URL");

  const res = await fetch(`${api}/api/v1/webhooks`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: `${appUrl}/api/webhooks/tabby`,
      is_test: key.startsWith("sk_test"),
      header: { title: "X-Webhook-Secret", value: secret },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Tabby ${res.status}: ${JSON.stringify(body)}`);
  console.log("Webhook registered:", JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
