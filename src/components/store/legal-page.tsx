import Link from "next/link";
import { RichText } from "@/components/store/rich-text";
import { Eyebrow } from "@/components/ui/primitives";
import { fmt } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { LEGAL_SLUGS, type LegalSlug } from "@/lib/legal";
import { getLegalPage } from "@/lib/server/catalog";
import { formatDate } from "@/lib/utils";

/** A legal/policy page as edited at /admin/pages (or its built-in text). */
export async function LegalPageView({ slug }: { slug: LegalSlug }) {
  const [page, dict, lang] = await Promise.all([getLegalPage(slug), getDictionary(), getLocale()]);
  const ar = lang === "ar";
  const others = await Promise.all(LEGAL_SLUGS.filter((s) => s !== slug).map((s) => getLegalPage(s)));
  return (
    <section className="px-4 pb-12 pt-36 md:pt-44">
      <article className="mx-auto max-w-3xl">
        {page.updatedAt > 0 && <Eyebrow>{fmt(dict.legal.updated, { date: formatDate(page.updatedAt, false, lang) })}</Eyebrow>}
        <h1 className="font-display mt-6 text-5xl leading-[0.92] md:text-6xl">{ar ? page.titleAr : page.title}</h1>
        <RichText text={ar ? page.bodyAr : page.body} className="mt-10" />
        <nav aria-label={dict.legal.more} className="mt-16 border-t border-ink/10 pt-8">
          <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-muted">{dict.legal.more}</p>
          <ul className="flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/legal/${o.slug}`} className="inline-block rounded-full px-4 py-2 text-sm text-ink/70 ring-1 ring-ink/10 transition hover:bg-cream hover:text-ink">
                  {ar ? o.titleAr : o.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </section>
  );
}
