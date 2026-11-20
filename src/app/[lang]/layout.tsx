import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic, Instrument_Serif, Noto_Naskh_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { dirOf, isLocale, locales } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n/server";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { alternates, siteUrl } from "@/lib/seo";
import "../globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
// Arabic glyphs fall through to these (Latin keeps Geist / Instrument Serif).
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600"],
});
const naskh = Noto_Naskh_Arabic({ variable: "--font-arabic-display", subsets: ["arabic"], weight: ["400", "500"] });

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: dict.meta.title, template: "%s · memo" },
    description: dict.meta.description,
    alternates: alternates(lang, "/"),
    openGraph: {
      type: "website",
      siteName: "memo",
      locale: lang === "ar" ? "ar_SA" : "en_SA",
      alternateLocale: lang === "ar" ? "en_SA" : "ar_SA",
      title: dict.meta.title,
      description: dict.meta.description,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary();

  return (
    <html
      lang={lang}
      dir={dirOf(lang)}
      className={`${geist.variable} ${geistMono.variable} ${instrument.variable} ${plexArabic.variable} ${naskh.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col">
        <I18nProvider lang={lang} dict={dict}>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
        <Toaster
          position="bottom-center"
          dir={dirOf(lang)}
          toastOptions={{
            className: "!rounded-full !bg-ink !text-paper !border-0 !shadow-[var(--shadow-float)] !font-sans",
          }}
        />
      </body>
    </html>
  );
}
