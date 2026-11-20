import { z } from "zod";
import { HOME_SECTIONS } from "@/lib/types";

/** What a merchant may send for a product. merchantId/name/slug and createdAt are set by the server. */
export const productInput = z.object({
  title: z.string().trim().min(1).max(140),
  titleAr: z.string().trim().max(140).default(""),
  description: z.string().trim().max(5000).default(""),
  descriptionAr: z.string().trim().max(5000).default(""),
  price: z.number().positive().max(1_000_000),
  compareAtPrice: z.number().positive().max(1_000_000).nullable().optional(),
  images: z.array(z.url()).min(1, "Add at least one image").max(8),
  categoryId: z.string().trim().min(1).max(80),
  stock: z.number().int().min(0).max(100_000),
  status: z.enum(["active", "draft"]),
});
export type ProductInput = z.infer<typeof productInput>;

export const merchantProfileInput = z.object({
  storeName: z.string().trim().min(2).max(60).optional(),
  tagline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(20).optional(),
  logoUrl: z.url().optional(),
  bannerUrl: z.url().optional(),
});

export const merchantApplyInput = z.object({
  storeName: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  city: z.string().trim().min(2).max(60),
  phone: z.string().trim().min(8).max(20),
  /** Saudi commercial registration: 10 digits */
  crNumber: z.string().trim().regex(/^\d{10}$/, "Commercial registration number must be 10 digits"),
  vatNumber: z.string().trim().regex(/^(\d{15})?$/, "VAT number must be 15 digits").default(""),
  acceptTerms: z.literal(true, "Please accept the merchant terms"),
});

export const bankInput = z.object({
  accountHolder: z.string().trim().min(2).max(100),
  bankName: z.string().trim().min(2).max(100),
  iban: z
    .string()
    .transform((s) => s.replace(/\s+/g, "").toUpperCase())
    .pipe(z.string().regex(/^SA\d{22}$/, "Enter a Saudi IBAN (SA + 22 digits)")),
});

export const settingsInput = z.object({
  commissionRate: z.number().min(0).max(0.5),
  tabbyFeeRate: z.number().min(0).max(0.2),
  tamaraFeeRate: z.number().min(0).max(0.2),
  passProviderFee: z.boolean(),
  vatRate: z.number().min(0).max(0.3),
  vatOnCommission: z.boolean(),
  sellerName: z.string().trim().min(1).max(120),
  /** KSA VAT registration numbers are 15 digits; empty until the business is registered */
  vatNumber: z.string().trim().regex(/^(\d{15})?$/, "VAT number must be 15 digits"),
  payoutHoldDays: z.number().int().min(0).max(60),
});

const text = (max: number) => z.string().trim().max(max).default("");
const docId = z.string().trim().min(1).max(80);

/** A page on this site ("/shop") or an https:// address — never javascript: or protocol-relative. */
const safeLink = z
  .string()
  .trim()
  .max(300)
  .refine((s) => s === "" || (s.startsWith("/") && !s.startsWith("//")) || /^https:\/\/[^\s]+$/.test(s), "Link must start with / or https://");

export const storefrontInput = z.object({
  hero: z.object({
    l1: text(40),
    l1Ar: text(40),
    l2: text(40),
    l2Ar: text(40),
    l3: text(40),
    l3Ar: text(40),
    body: text(240),
    bodyAr: text(240),
  }),
  heroProductIds: z.array(docId).max(3),
  featuredCategoryIds: z.array(docId).max(12),
  featuredProductIds: z.array(docId).max(12),
  banner: z
    .object({
      enabled: z.boolean(),
      image: z.union([z.url(), z.literal("")]),
      link: safeLink,
      title: text(80),
      titleAr: text(80),
      subtitle: text(160),
      subtitleAr: text(160),
    })
    .refine((b) => !b.enabled || (b.image && (b.title || b.titleAr)), "A visible banner needs an image and a title"),
  sections: z
    .array(z.object({ id: z.enum(HOME_SECTIONS), visible: z.boolean() }))
    .length(HOME_SECTIONS.length)
    .refine((s) => new Set(s.map((x) => x.id)).size === s.length, "Each section can appear once"),
});

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  nameAr: text(60),
  blurb: text(160),
  blurbAr: text(160),
  image: z.union([z.url(), z.literal("")]).default(""),
});
