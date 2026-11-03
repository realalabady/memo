import "server-only";
import type { Provider } from "@/lib/types";
import { tabbyConfigured } from "./tabby";
import { tamaraConfigured } from "./tamara";

/**
 * The simulator lets you run the full order → ledger → payout flow before
 * your Tabby/Tamara keys are live. It is never used in production unless
 * PAYMENTS_DEMO=true is set explicitly.
 */
export function shouldSimulate(provider: Provider) {
  if (process.env.PAYMENTS_DEMO === "true") return true;
  const configured = provider === "tabby" ? tabbyConfigured() : tamaraConfigured();
  return !configured && process.env.NODE_ENV !== "production";
}
