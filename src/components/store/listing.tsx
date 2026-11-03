import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/motion";
import { Eyebrow } from "@/components/ui/primitives";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListingHeader({ eyebrow, title, intro }: { eyebrow: string; title: ReactNode; intro?: string }) {
  return (
    <Reveal className="mb-12">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="font-display mt-6 text-6xl leading-[0.92] md:text-8xl">{title}</h1>
      {intro && <p className="mt-6 max-w-lg text-ink/60">{intro}</p>}
    </Reveal>
  );
}

export function CategoryPills({ categories, active }: { categories: Category[]; active?: string }) {
  return (
    <div className="no-scrollbar -mx-4 mb-12 flex gap-2 overflow-x-auto px-4">
      <Link
        href="/shop"
        className={cn("shrink-0 rounded-full px-4 py-2 text-sm ring-1 ring-ink/10 transition", !active ? "bg-ink text-paper" : "hover:bg-ink/5")}
      >
        Everything
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/category/${c.slug}`}
          className={cn("shrink-0 rounded-full px-4 py-2 text-sm ring-1 ring-ink/10 transition", active === c.id ? "bg-ink text-paper" : "hover:bg-ink/5")}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-[2rem] bg-cream" />
      ))}
    </div>
  );
}
