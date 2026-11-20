import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/** Public origin, e.g. https://memo.sa (NEXT_PUBLIC_APP_URL is required in production). */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Canonical + hreflang links for a page path without the locale, e.g. "/shop". */
export function alternates(lang: Locale, path: string): Metadata["alternates"] {
  const p = path === "/" ? "" : path;
  return {
    canonical: `/${lang}${p}`,
    languages: { ...Object.fromEntries(locales.map((l) => [l, `/${l}${p}`])), "x-default": `/${defaultLocale}${p}` },
  };
}

/** Short plain-text description for meta tags. */
export function clip(text: string | undefined, max = 160) {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** JSON for a <script type="application/ld+json">, safe to inline in HTML. */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
