import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LegalPageView } from "@/components/store/legal-page";
import { getLocale } from "@/i18n/server";
import { isLegalSlug, LEGAL_SLUGS } from "@/lib/legal";
import { getLegalPage } from "@/lib/server/catalog";
import { alternates, clip } from "@/lib/seo";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return {};
  const [page, lang] = await Promise.all([getLegalPage(slug), getLocale()]);
  const ar = lang === "ar";
  return {
    title: ar ? page.titleAr : page.title,
    description: clip((ar ? page.bodyAr : page.body).replace(/^[#\-\s]+/gm, "")),
    alternates: alternates(lang, `/legal/${slug}`),
  };
}

async function LegalContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  return <LegalPageView slug={slug} />;
}

export default function LegalPage({ params }: PageProps<"/[lang]/legal/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-44 h-96 max-w-3xl animate-pulse rounded-[2rem] bg-cream" />}>
      <LegalContent params={params} />
    </Suspense>
  );
}
