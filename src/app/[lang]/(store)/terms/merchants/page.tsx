import type { Metadata } from "next";
import { LegalPageView } from "@/components/store/legal-page";
import { getLocale } from "@/i18n/server";
import { getLegalPage } from "@/lib/server/catalog";
import { alternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [page, lang] = await Promise.all([getLegalPage("merchant-terms"), getLocale()]);
  return { title: lang === "ar" ? page.titleAr : page.title, alternates: alternates(lang, "/legal/merchant-terms") };
}

/** Kept for links already in the wild; same content as /legal/merchant-terms (editable at /admin/pages). */
export default function MerchantTermsPage() {
  return <LegalPageView slug="merchant-terms" />;
}
