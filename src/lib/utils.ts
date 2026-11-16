import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { intlLocale, type Locale } from "@/i18n/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "SAR 1,290" in English, "1,290 ر.س" in Arabic (Latin digits in both). */
export function formatSAR(value: number, opts: { decimals?: boolean; lang?: Locale } = {}) {
  const lang = opts.lang ?? "en";
  const n = value.toLocaleString(intlLocale(lang), {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return lang === "ar" ? `${n} ر.س` : `SAR ${n}`;
}

/** Money is computed in halalas to avoid float drift, stored in SAR with 2 decimals */
export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** URL slug that keeps Arabic (and other) letters, so non-Latin names never produce an empty slug. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function installment(total: number, parts = 4) {
  return round2(total / parts);
}

export function formatDate(ms: number, withTime = false, lang: Locale = "en") {
  return new Date(ms).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}
