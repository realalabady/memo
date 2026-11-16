"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

function Switch({ className }: { className?: string }) {
  const lang = useLocale();
  const t = useT();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const other = lang === "ar" ? "en" : "ar";
  const parts = pathname.split("/");
  const rest = isLocale(parts[1]) ? `/${parts.slice(2).join("/")}` : pathname;
  // A plain <a> forces a full load so <html lang/dir> and fonts switch cleanly; the proxy remembers the choice.
  const href = `/${other}${rest === "/" ? "" : rest}${search ? `?${search}` : ""}`;
  return (
    <a
      href={href}
      hrefLang={other}
      aria-label={t.common.languageLabel}
      className={cn("rounded-full px-3 py-2 text-[13px] text-ink/70 transition hover:bg-ink/[0.05] hover:text-ink", className)}
    >
      {t.common.language}
    </a>
  );
}

export function LanguageSwitch({ className }: { className?: string }) {
  return (
    <Suspense>
      <Switch className={className} />
    </Suspense>
  );
}
