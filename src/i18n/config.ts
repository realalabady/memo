/** Supported languages. Arabic is the default for Saudi shoppers. */
export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";
export const LOCALE_COOKIE = "memo-locale";

export const isLocale = (v: string | undefined | null): v is Locale => !!v && (locales as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");
/** BCP-47 tag for Intl formatting. Latin digits in both languages (common for Saudi commerce). */
export const intlLocale = (l: Locale) => (l === "ar" ? "ar-SA-u-nu-latn" : "en-SA");

/** "/en/shop" → "/shop" (paths without a locale prefix are returned unchanged). */
export function stripLocale(pathname: string) {
  const parts = pathname.split("/");
  return isLocale(parts[1]) ? `/${parts.slice(2).join("/")}` : pathname;
}

/** Pick the localized variant of a content field (e.g. title → titleAr), falling back to the base field. */
export function localized<T extends object, K extends keyof T & string>(obj: T, field: K, lang: Locale): T[K] {
  if (lang === "ar") {
    const ar = (obj as Record<string, unknown>)[`${field}Ar`];
    if (typeof ar === "string" && ar.trim()) return ar as T[K];
  }
  return obj[field];
}
