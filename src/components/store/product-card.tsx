import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatSAR, installment } from "@/lib/utils";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const off = product.compareAtPrice ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  return (
    <Link href={`/product/${product.id}`} className="group block">
      <div className="rounded-[2rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06] transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:-translate-y-1">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-sand">
          {product.images[0] && (
            <Image
              src={product.images[0]}
              alt={product.title}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-fluid)] group-hover:scale-[1.06]"
            />
          )}
          {off > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-ember px-2.5 py-1 text-[11px] font-medium text-paper">
              −{off}%
            </span>
          )}
          <span className="absolute inset-x-3 bottom-3 translate-y-3 rounded-full bg-paper/90 px-4 py-2 text-center text-[12px] opacity-0 backdrop-blur transition-all duration-500 ease-[var(--ease-fluid)] group-hover:translate-y-0 group-hover:opacity-100">
            4 × {formatSAR(installment(product.price), { decimals: true })} with tabby / tamara
          </span>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 px-2 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium">{product.title}</h3>
          <p className="text-[13px] text-muted">{product.merchantName}</p>
        </div>
        <div className="text-right">
          <p className="text-[15px] tabular-nums">{formatSAR(product.price)}</p>
          {product.compareAtPrice && (
            <p className="text-[12px] text-muted line-through tabular-nums">{formatSAR(product.compareAtPrice)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return (
      <div className="rounded-[2rem] bg-cream/60 px-6 py-24 text-center">
        <p className="font-display text-3xl italic">Nothing on the shelf yet.</p>
        <p className="mt-2 text-sm text-muted">Check back soon — new stores join every week.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
