export type Role = "admin" | "merchant" | "customer";
export type Provider = "tabby" | "tamara";
export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded";
export type FulfillmentStatus = "pending" | "shipped" | "delivered";
export type PayoutStatus = "unpaid" | "paid" | "on_hold";
export type MerchantStatus = "pending" | "approved" | "suspended" | "rejected";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  phone?: string;
  /** Account disabled by an admin (mirrors Firebase Auth) */
  disabled?: boolean;
  createdAt: number;
}

export interface Merchant {
  id: string; // = owner uid
  storeName: string;
  slug: string;
  tagline?: string;
  taglineAr?: string;
  bio?: string;
  bioAr?: string;
  logoUrl?: string;
  bannerUrl?: string;
  city?: string;
  phone?: string;
  email?: string;
  status: MerchantStatus;
  /** Optional override of the platform commission (0.1 = 10%) */
  commissionRate?: number;
  /** Shown to the owner when status is "rejected" */
  rejectionReason?: string;
  termsAcceptedAt?: number;
  termsVersion?: string;
  createdAt: number;
}

/** merchants/{id}/private/contact — owner + admin only (contact and KYC details) */
export interface MerchantContact {
  email: string;
  phone: string;
  /** Commercial registration number */
  crNumber: string;
  vatNumber?: string;
  updatedAt: number;
}

export const MERCHANT_TERMS_VERSION = "2026-11";

/** merchants/{id}/private/bank — only owner + admin can read */
export interface MerchantBank {
  accountHolder: string;
  bankName: string;
  iban: string;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  blurb?: string;
  blurbAr?: string;
  image?: string;
  order: number;
}

export interface Product {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  price: number; // SAR, VAT included
  compareAtPrice?: number;
  images: string[];
  categoryId: string;
  stock: number;
  /** "archived" = deleted by the merchant; kept so past orders still resolve */
  status: "active" | "draft" | "archived";
  /** Average of visible reviews (1–5) and how many there are; maintained by /api/reviews */
  ratingAvg?: number;
  ratingCount?: number;
  ratingSum?: number;
  /** Unpublished by an admin; kept as "draft" until an admin releases it */
  hiddenByAdmin?: boolean;
  hiddenReason?: string;
  /** Status to restore when an admin releases the product */
  statusBeforeHide?: "active" | "draft";
  createdAt: number;
  updatedAt?: number;
}

/** products/{productId}/reviews/{uid} — one review per verified buyer */
export interface Review {
  uid: string;
  displayName: string;
  rating: number;
  text: string;
  hidden?: boolean;
  reply?: { text: string; at: number };
  createdAt: number;
  updatedAt?: number;
}

/** users/{uid}/addresses/{id} */
export interface SavedAddress extends Address {
  id: string;
  label?: string;
  createdAt: number;
}

export interface OrderLine {
  productId: string;
  merchantId: string;
  title: string;
  titleAr?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface Address {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  line1: string;
  zip?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customer: Address;
  items: OrderLine[];
  merchantIds: string[];
  subtotal: number;
  /** What the shopper pays, VAT included */
  total: number;
  /** VAT contained in `total` */
  vatAmount?: number;
  /** Sum refunded so far (full refund ⇒ paymentStatus "refunded") */
  refundedAmount?: number;
  /** Set when the provider reports something we could not reconcile automatically */
  needsReview?: string;
  currency: "SAR";
  provider: Provider | "demo";
  paymentStatus: PaymentStatus;
  providerCheckoutId?: string;
  providerPaymentId?: string;
  failureReason?: string;
  /** true while stock for this order is held (reserved at checkout, kept once paid) */
  stockReserved?: boolean;
  /** unpaid orders past this time are expired by /api/cron/expire-orders */
  reservedUntil?: number;
  /** settlement lease (return URL vs webhook) */
  settleLockUntil?: number;
  /** paid after its reservation was released and stock ran out — needs admin follow-up */
  oversold?: boolean;
  createdAt: number;
  paidAt?: number;
  refundedAt?: number;
}

/**
 * One document per (order × merchant). This is the payout ledger:
 * it tells the admin exactly how much of each payment belongs to which merchant.
 */
export interface MerchantOrder {
  id: string; // `${orderId}_${merchantId}`
  orderId: string;
  merchantId: string;
  merchantName: string;
  customerId: string;
  customer: Address;
  items: OrderLine[];
  provider: Provider | "demo";
  subtotal: number;
  commissionRate: number;
  commission: number;
  providerFeeRate: number;
  providerFee: number;
  payoutAmount: number;
  /** VAT contained in `subtotal` */
  vatAmount?: number;
  /** VAT charged on the commission (0 unless settings.vatOnCommission) */
  commissionVat?: number;
  paymentStatus: PaymentStatus;
  /** "pending" while a refund is being sent to the provider */
  refundState?: "pending" | "done";
  refundedAt?: number;
  refundReason?: string;
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber?: string;
  shippedAt?: number;
  deliveredAt?: number;
  payoutStatus: PayoutStatus;
  payoutId?: string;
  createdAt: number;
  paidAt?: number;
}

export interface Payout {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  merchantOrderIds: string[];
  /** Refund clawbacks netted into this payout (negative total) */
  adjustmentIds?: string[];
  adjustmentsTotal?: number;
  reference: string;
  note?: string;
  createdBy: string;
  createdAt: number;
}

export interface PlatformSettings {
  commissionRate: number;
  tabbyFeeRate: number;
  tamaraFeeRate: number;
  /** When true, the BNPL provider fee is deducted from the merchant's payout */
  passProviderFee: boolean;
  /** KSA VAT. Shown prices include it. */
  vatRate: number;
  /** When true, VAT is added on top of the commission and deducted from the payout */
  vatOnCommission: boolean;
  /** Printed on invoices */
  sellerName: string;
  vatNumber: string;
  /** A paid order becomes payable this many days after it is delivered */
  payoutHoldDays: number;
}

/** Money owed back by a merchant after a refund on an order that was already paid out. */
export interface LedgerAdjustment {
  id: string;
  merchantId: string;
  merchantOrderId: string;
  orderId: string;
  /** Negative = deducted from the next payout */
  amount: number;
  reason: string;
  status: "open" | "applied";
  payoutId?: string;
  createdAt: number;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  commissionRate: 0.1,
  tabbyFeeRate: 0.0499,
  tamaraFeeRate: 0.0499,
  passProviderFee: true,
  vatRate: 0.15,
  vatOnCommission: false,
  sellerName: "memo marketplace",
  vatNumber: "",
  payoutHoldDays: 3,
};

/** Home page building blocks, in the order the admin arranges them. */
export const HOME_SECTIONS = ["categories", "banner", "featured", "how", "stores", "sell"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/** settings/storefront — the home page, edited at /admin/storefront. Empty text falls back to the built-in copy. */
export interface StorefrontSettings {
  hero: { l1: string; l1Ar: string; l2: string; l2Ar: string; l3: string; l3Ar: string; body: string; bodyAr: string };
  /** Up to 3 products floating in the hero; empty = one per category */
  heroProductIds: string[];
  /** Categories shown in the home grid, in this order; empty = all */
  featuredCategoryIds: string[];
  /** Products in the "just landed" grid, in this order; empty = newest */
  featuredProductIds: string[];
  banner: { enabled: boolean; image: string; link: string; title: string; titleAr: string; subtitle: string; subtitleAr: string };
  sections: { id: HomeSection; visible: boolean }[];
  updatedAt: number;
}

export const DEFAULT_STOREFRONT: StorefrontSettings = {
  hero: { l1: "", l1Ar: "", l2: "", l2Ar: "", l3: "", l3Ar: "", body: "", bodyAr: "" },
  heroProductIds: [],
  featuredCategoryIds: [],
  featuredProductIds: [],
  banner: { enabled: false, image: "", link: "", title: "", titleAr: "", subtitle: "", subtitleAr: "" },
  sections: HOME_SECTIONS.map((id) => ({ id, visible: id !== "banner" })),
  updatedAt: 0,
};

/** Fills gaps in a stored storefront doc (new sections, missing fields). */
export function withStorefrontDefaults(raw: Partial<StorefrontSettings> | undefined): StorefrontSettings {
  const d = DEFAULT_STOREFRONT;
  const known = (raw?.sections ?? []).filter((s) => (HOME_SECTIONS as readonly string[]).includes(s.id));
  const sections = [...known, ...d.sections.filter((s) => !known.some((k) => k.id === s.id))];
  return {
    ...d,
    ...raw,
    hero: { ...d.hero, ...raw?.hero },
    banner: { ...d.banner, ...raw?.banner },
    sections,
  };
}

export interface AuditLog {
  id: string;
  actorUid: string;
  action: string;
  target: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

/** GET /api/admin/stats — totals over the whole ledger */
export interface AdminStats {
  paidCount: number;
  collected: number;
  commission: number;
  providerFees: number;
  tabby: number;
  tamara: number;
  owed: number;
  balances: { id: string; name: string; amount: number; count: number }[];
  transferred: number;
  payoutCount: number;
}
