import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { siteUrl } from "@/lib/seo";

/** Private areas (dashboards, account, checkout, API) stay out of search engines. */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/admin", "/merchant", "/account", "/checkout", "/login", "/signup", "/brand"];
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...privatePaths, ...locales.flatMap((l) => privatePaths.map((p) => `/${l}${p}`))],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
