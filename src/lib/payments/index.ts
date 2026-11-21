import "server-only";
import type { Provider } from "@/lib/types";
import { tabbyConfigured, tamaraConfigured } from "@/lib/server/payment-config";

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * The simulator lets you run the full order → ledger → payout flow before
 * your Tabby/Tamara keys are live. It is NEVER available in production:
 * `PAYMENTS_DEMO=true` is ignored there (and src/instrumentation.ts refuses to boot with it).
 */
export async function shouldSimulate(provider: Provider) {
  if (isProduction()) return false;
  if (process.env.PAYMENTS_DEMO === "true") return true;
  return !(await providerConfigured(provider));
}

export function providerConfigured(provider: Provider) {
  return provider === "tabby" ? tabbyConfigured() : tamaraConfigured();
}
