import { z } from "zod";

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
