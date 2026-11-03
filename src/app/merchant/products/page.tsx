"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { ButtonLink, StatusPill } from "@/components/ui/primitives";
import { useAuth, useAuthedFetch } from "@/lib/auth/auth-provider";
import { useCategories, useMerchantProducts } from "@/lib/data/hooks";
import { deleteProduct } from "@/lib/data/mutations";
import { formatSAR } from "@/lib/utils";

export default function MerchantProducts() {
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const { data: products, loading } = useMerchantProducts(user?.uid ?? null);
  const { data: categories } = useCategories();
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    try {
      await deleteProduct(id);
      await authedFetch("/api/revalidate", { method: "POST" });
      toast("Product deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={`${products.length} products`} title={<>Your <span className="italic">shelf</span></>} actions={<ButtonLink href="/merchant/products/new">Add product</ButtonLink>} />
      <Panel>
        <Table head={["Product", "Category", "Price", "Stock", "Status", ""]} empty={!loading && !products.length}>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="relative size-12 overflow-hidden rounded-xl bg-sand">
                    {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  <span className="font-medium">{p.title}</span>
                </div>
              </td>
              <td className="text-muted">{catName(p.categoryId)}</td>
              <td className="tabular-nums">{formatSAR(p.price)}</td>
              <td className={p.stock <= 3 ? "text-ember tabular-nums" : "tabular-nums"}>{p.stock}</td>
              <td><StatusPill status={p.status} /></td>
              <td className="text-right">
                <Link href={`/merchant/products/${p.id}`} className="rounded-full px-3 py-1.5 text-xs ring-1 ring-ink/10 hover:bg-cream">Edit</Link>
                <button onClick={() => remove(p.id, p.title)} className="ml-2 rounded-full px-3 py-1.5 text-xs text-muted hover:text-ember">Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
