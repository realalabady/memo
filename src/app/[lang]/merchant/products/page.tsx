"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { ButtonLink, StatusPill } from "@/components/ui/primitives";
import { localized } from "@/i18n/config";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCategories, useMerchantProducts } from "@/lib/data/hooks";
import { deleteProduct } from "@/lib/data/mutations";

export default function MerchantProducts() {
  const t = useT().merchant;
  const { col } = useT().dash;
  const common = useT().common;
  const { money, lang } = useFormat();
  const { user } = useAuth();
  const { data: products, loading } = useMerchantProducts(user?.uid ?? null);
  const { data: categories } = useCategories();
  const catName = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? localized(c, "name", lang) : "—";
  };

  async function remove(id: string, title: string) {
    if (!confirm(fmt(t.confirmDelete, { title }))) return;
    try {
      await deleteProduct(id);
      toast(t.productDeleted);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={fmt(t.productsCount, { n: products.length })}
        title={<>{t.shelfTitle} <span className="italic">{t.shelfEm}</span></>}
        actions={<ButtonLink href="/merchant/products/new">{t.addProduct}</ButtonLink>}
      />
      <Panel>
        <Table head={[col.product, col.category, col.price, col.stock, col.status, ""]} empty={!loading && !products.length}>
          {products.map((p) => {
            const title = localized(p, "title", lang);
            return (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 overflow-hidden rounded-xl bg-sand">
                      {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                    <span className="font-medium">{title}</span>
                  </div>
                </td>
                <td className="text-muted">{catName(p.categoryId)}</td>
                <td className="tabular-nums">{money(p.price)}</td>
                <td className={p.stock <= 3 ? "text-ember tabular-nums" : "tabular-nums"}>{p.stock}</td>
                <td><StatusPill status={p.status} /></td>
                <td className="whitespace-nowrap text-end">
                  <Link href={`/merchant/products/${p.id}`} className="rounded-full px-3 py-1.5 text-xs ring-1 ring-ink/10 hover:bg-cream">{common.edit}</Link>
                  <button onClick={() => remove(p.id, title)} className="ms-2 rounded-full px-3 py-1.5 text-xs text-muted hover:text-ember">{common.delete}</button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </>
  );
}
