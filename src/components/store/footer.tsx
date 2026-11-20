"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/i18n/client";

export function StoreFooter() {
  const t = useT().footer;
  const columns = [
    { title: t.shop, links: [[t.allProducts, "/shop"], [t.categories, "/#categories"], [t.payIn4, "/#how"]] },
    { title: t.sell, links: [[t.openStore, "/sell"], [t.merchantHub, "/merchant"]] },
    { title: t.account, links: [[t.signIn, "/login"], [t.myOrders, "/account"]] },
    {
      title: t.help,
      links: [
        [t.shipping, "/legal/shipping"],
        [t.returns, "/legal/returns"],
        [t.privacy, "/legal/privacy"],
        [t.terms, "/legal/terms"],
      ],
    },
  ];
  return (
    <footer className="mt-auto px-4 pb-6 pt-24">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-ink px-6 pb-8 pt-16 text-paper md:px-12">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <p className="font-display text-5xl leading-[0.95] md:text-7xl">
              <span className="block">{t.line1}</span>
              <span className="block italic text-ember">{t.line2}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm md:col-span-6 md:grid-cols-4">
            {columns.map((c) => (
              <div key={c.title}>
                <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-paper/40">{c.title}</p>
                <ul className="space-y-2.5">
                  {c.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-paper/70 transition hover:text-paper">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-20 flex flex-col items-start justify-between gap-6 border-t border-white/10 pt-6 text-xs text-paper/40 md:flex-row md:items-center">
          <span className="flex items-center gap-2 text-paper">
            <LogoMark className="size-5" /> {t.brand}
          </span>
          <span className="flex items-center gap-4">
            {t.note}
            <LanguageSwitch className="text-paper/60 hover:bg-white/10 hover:text-paper" />
          </span>
        </div>
      </div>
    </footer>
  );
}
