import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export function StoreFooter() {
  return (
    <footer className="mt-auto px-4 pb-6 pt-24">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-ink px-6 pb-8 pt-16 text-paper md:px-12">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <p className="font-display text-5xl leading-[0.95] md:text-7xl">
              Buy it today.
              <br />
              <span className="italic text-ember">Own it in four.</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm md:col-span-6 md:grid-cols-3">
            {[
              { t: "Shop", l: [["All products", "/shop"], ["Categories", "/#categories"], ["Pay in 4", "/#how"]] },
              { t: "Sell", l: [["Open a store", "/sell"], ["Merchant hub", "/merchant"]] },
              { t: "Account", l: [["Sign in", "/login"], ["My orders", "/account"]] },
            ].map((c) => (
              <div key={c.t}>
                <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-paper/40">{c.t}</p>
                <ul className="space-y-2.5">
                  {c.l.map(([label, href]) => (
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
            <LogoMark className="size-5" /> memo marketplace
          </span>
          <span>Installments by Tabby & Tamara. Prices in SAR.</span>
        </div>
      </div>
    </footer>
  );
}
