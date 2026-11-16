"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { formatDate, formatSAR } from "@/lib/utils";
import { intlLocale, type Locale } from "./config";
import type { Dictionary } from "./dictionaries";

const Ctx = createContext<{ lang: Locale; dict: Dictionary } | null>(null);

export function I18nProvider({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  const value = useMemo(() => ({ lang, dict }), [lang, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>");
  return ctx;
}

/** The dictionary for the current language (client components). */
export const useT = () => useI18n().dict;
/** The current language (client components). */
export const useLocale = () => useI18n().lang;
/** BCP-47 tag for Intl formatting in the current language. */
export const useIntlLocale = () => intlLocale(useI18n().lang);

/** Locale-aware money and date formatters for client components. */
export function useFormat() {
  const { lang } = useI18n();
  const money = useCallback((v: number, opts: { decimals?: boolean } = {}) => formatSAR(v, { ...opts, lang }), [lang]);
  const date = useCallback((ms: number, withTime = false) => formatDate(ms, withTime, lang), [lang]);
  return { money, date, lang };
}
