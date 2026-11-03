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
export type MerchantStatus = "pending" | "approved" | "suspended";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  phone?: string;
  createdAt: number;
}

export interface Merchant {
  id: string; // = owner uid
  storeName: string;
  slug: string;
  tagline?: string;
  bio?: string;
  logoUrl?: string;
  bannerUrl?: string;
  city?: string;
  phone?: string;
  email?: string;
  status: MerchantStatus;
  /** Optional override of the platform commission (0.1 = 10%) */
  commissionRate?: number;
  createdAt: number;
}

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
  slug: string;
  blurb?: string;
  image?: string;
  order: number;
}

export interface Product {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  title: string;
  description: string;
  price: number; // SAR
  compareAtPrice?: number;
  images: string[];
  categoryId: string;
  stock: number;
  status: "active" | "draft";
  createdAt: number;
}

export interface OrderLine {
  productId: string;
  merchantId: string;
  title: string;
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
  total: number;
  currency: "SAR";
  provider: Provider | "demo";
  paymentStatus: PaymentStatus;
  providerCheckoutId?: string;
  providerPaymentId?: string;
  failureReason?: string;
  createdAt: number;
  paidAt?: number;
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
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber?: string;
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
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  commissionRate: 0.1,
  tabbyFeeRate: 0.0499,
  tamaraFeeRate: 0.0499,
  passProviderFee: true,
};
