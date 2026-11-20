/**
 * Legal & policy pages (pages/{slug}), edited by admins at /admin/pages and shown at /legal/{slug}.
 * Bodies use a tiny text format: "## " heading, "- " bullet, blank line between paragraphs.
 * The defaults below are placeholders: have a lawyer review the wording before launch.
 */
export const LEGAL_SLUGS = ["terms", "privacy", "returns", "shipping", "merchant-terms"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
export const isLegalSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s);

export interface LegalPage {
  slug: LegalSlug;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  /** 0 = never edited (built-in text) */
  updatedAt: number;
}

export const DEFAULT_LEGAL: Record<LegalSlug, Omit<LegalPage, "slug" | "updatedAt">> = {
  terms: {
    title: "Terms of use",
    titleAr: "شروط الاستخدام",
    body: `memo is a marketplace: independent stores list and sell their products, and memo collects the payment on their behalf.

## Your account
- Keep your password private. You are responsible for orders placed from your account.
- You must give accurate contact and delivery details.

## Orders and payment
- Prices are in Saudi riyals and include 15% VAT.
- Payment is taken by Tabby or Tamara in four instalments. Their own terms apply to the instalment plan.
- An order is confirmed once the payment provider approves it.

## Stores
Each product is sold by the store named on its page. The store is responsible for the product, its description and its delivery.

## Changes
We may update these terms. The date at the top of this page shows the latest version.`,
    bodyAr: `memo سوق إلكتروني: تعرض المتاجر المستقلة منتجاتها وتبيعها، وتتولى memo تحصيل المبلغ نيابةً عنها.

## حسابك
- حافظ على سرية كلمة المرور. أنت مسؤول عن الطلبات التي تتم من حسابك.
- يجب أن تكون بيانات التواصل والتوصيل صحيحة.

## الطلبات والدفع
- الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة 15٪.
- يتم الدفع عبر تابي أو تمارا على أربع دفعات، وتسري شروطهما على خطة التقسيط.
- يتأكد الطلب بعد موافقة مزوّد الدفع.

## المتاجر
يُباع كل منتج من المتجر المذكور في صفحته، والمتجر مسؤول عن المنتج ووصفه وتوصيله.

## التعديلات
قد نحدّث هذه الشروط، ويظهر تاريخ آخر نسخة أعلى هذه الصفحة.`,
  },
  privacy: {
    title: "Privacy policy",
    titleAr: "سياسة الخصوصية",
    body: `This policy explains what personal data memo collects and why.

## What we collect
- Account details: name, email and mobile number.
- Delivery addresses you enter at checkout or save in your account.
- Order history and reviews you write.

## How we use it
- To process your orders and share the delivery details with the store that ships them.
- To send your order to Tabby or Tamara so they can approve the payment.
- To prevent fraud and meet our tax and legal obligations.

## Who we share it with
Only the stores you buy from, the payment providers, and service providers that host our systems. We do not sell your data.

## Your rights
You can view and edit your profile and addresses in your account, and ask us to delete your account by contacting support.`,
    bodyAr: `توضح هذه السياسة البيانات الشخصية التي تجمعها memo وسبب جمعها.

## ما نجمعه
- بيانات الحساب: الاسم والبريد الإلكتروني ورقم الجوال.
- عناوين التوصيل التي تُدخلها عند الدفع أو تحفظها في حسابك.
- سجل الطلبات والتقييمات التي تكتبها.

## كيف نستخدمها
- لتنفيذ طلباتك ومشاركة بيانات التوصيل مع المتجر الذي يشحنها.
- لإرسال طلبك إلى تابي أو تمارا للموافقة على الدفع.
- لمنع الاحتيال والوفاء بالتزاماتنا الضريبية والنظامية.

## مع من نشاركها
فقط مع المتاجر التي تشتري منها ومزوّدي الدفع ومزوّدي الخدمات الذين يستضيفون أنظمتنا. لا نبيع بياناتك.

## حقوقك
يمكنك عرض ملفك وعناوينك وتعديلها من حسابك، وطلب حذف حسابك بالتواصل مع الدعم.`,
  },
  returns: {
    title: "Returns & refunds",
    titleAr: "الاسترجاع والاسترداد",
    body: `You can return most items within 7 days of delivery.

## Conditions
- The item must be unused, in its original packaging, with any tags attached.
- Perfume, cosmetics and personal-care items can only be returned if unopened.
- Some products cannot be returned; the product page says so when that is the case.

## How to return
- Open the order in your account and contact the store, or contact our support with the order number.
- The store confirms the return and tells you how to send the item back.

## Refunds
- Once the store receives the item, we refund the payment through Tabby or Tamara.
- Paid instalments are returned to your card and the remaining instalments are cancelled.
- Refunds usually appear within 5–14 days, depending on your bank.

## Damaged or wrong items
Contact us within 48 hours of delivery with photos. We arrange a replacement or a full refund at no cost to you.`,
    bodyAr: `يمكنك إرجاع معظم المنتجات خلال 7 أيام من التوصيل.

## الشروط
- يجب أن يكون المنتج غير مستخدم وفي غلافه الأصلي مع البطاقات المرفقة.
- العطور ومستحضرات التجميل والعناية الشخصية تُرجع فقط إن لم تُفتح.
- بعض المنتجات غير قابلة للإرجاع، ويُذكر ذلك في صفحة المنتج.

## طريقة الإرجاع
- افتح الطلب من حسابك وتواصل مع المتجر، أو تواصل مع الدعم برقم الطلب.
- يؤكد المتجر الإرجاع ويخبرك بطريقة إعادة المنتج.

## الاسترداد
- بعد استلام المتجر للمنتج، نعيد المبلغ عبر تابي أو تمارا.
- تُعاد الدفعات المسددة إلى بطاقتك وتُلغى الدفعات المتبقية.
- يظهر المبلغ عادةً خلال 5 إلى 14 يومًا حسب البنك.

## المنتجات التالفة أو الخاطئة
تواصل معنا خلال 48 ساعة من التوصيل مع صور، وسنرتب الاستبدال أو استرداد المبلغ كاملًا دون أي تكلفة عليك.`,
  },
  shipping: {
    title: "Delivery & shipping",
    titleAr: "التوصيل والشحن",
    body: `Every store ships its own orders across Saudi Arabia.

## Cost
Delivery is free on all orders.

## Delivery times
- Riyadh, Jeddah and the Eastern Province: usually 2–4 working days.
- Other cities: usually 3–7 working days.
- An order with items from several stores arrives in separate parcels.

## Tracking
When a store ships your items, its tracking number appears on the order page in your account.

## Problems with delivery
If your parcel is late or missing, contact the store from your order page or reach our support with the order number.`,
    bodyAr: `يشحن كل متجر طلباته بنفسه إلى جميع مناطق المملكة.

## التكلفة
التوصيل مجاني لجميع الطلبات.

## مدة التوصيل
- الرياض وجدة والمنطقة الشرقية: عادةً من 2 إلى 4 أيام عمل.
- المدن الأخرى: عادةً من 3 إلى 7 أيام عمل.
- الطلب الذي يضم منتجات من عدة متاجر يصل في طرود منفصلة.

## التتبع
عند شحن المتجر لمنتجاتك يظهر رقم التتبع في صفحة الطلب في حسابك.

## مشاكل التوصيل
إذا تأخر الطرد أو فُقد، تواصل مع المتجر من صفحة الطلب أو مع الدعم برقم الطلب.`,
  },
  "merchant-terms": {
    title: "Merchant terms",
    titleAr: "شروط التاجر",
    body: `These terms apply to every store that sells on memo.

## Listings
Products must be genuine, legal to sell in Saudi Arabia and described accurately. Prices include VAT.

## Payments
Shoppers pay through memo's Tabby and Tamara accounts. memo keeps its commission and pays the rest to your bank account.

## Payouts
An order becomes payable a few days after it is delivered (the hold period shown in your dashboard). Payouts are bank transfers to the IBAN you saved.

## Fulfilment
You ship your own orders, add the tracking number, and mark them delivered.

## Returns and refunds
You accept returns under the marketplace returns policy. If an order is refunded after it was paid out, the amount is deducted from your next payout.

## Suspension
memo may hide products or suspend a store that breaks these terms or the law.`,
    bodyAr: `تسري هذه الشروط على كل متجر يبيع على memo.

## المنتجات
يجب أن تكون المنتجات أصلية ومسموحًا ببيعها في المملكة وموصوفة بدقة. الأسعار تشمل ضريبة القيمة المضافة.

## المدفوعات
يدفع المتسوقون عبر حسابات memo لدى تابي وتمارا، وتحتفظ memo بعمولتها وتحوّل الباقي إلى حسابك البنكي.

## التحويلات
يصبح الطلب مستحقًا للتحويل بعد أيام من توصيله (فترة الاحتفاظ الظاهرة في لوحتك). تتم التحويلات بنكيًا إلى الآيبان المحفوظ.

## التنفيذ
تشحن طلباتك بنفسك وتضيف رقم التتبع وتحدّث حالتها إلى «تم التوصيل».

## الاسترجاع والاسترداد
تقبل الإرجاع وفق سياسة الاسترجاع في السوق. إذا استُرد مبلغ طلب بعد تحويله إليك يُخصم من تحويلك التالي.

## الإيقاف
يحق لـ memo إخفاء المنتجات أو إيقاف المتجر المخالف لهذه الشروط أو للأنظمة.`,
  },
};

export function withLegalDefaults(slug: LegalSlug, raw?: Partial<LegalPage>): LegalPage {
  const d = DEFAULT_LEGAL[slug];
  return {
    slug,
    title: raw?.title || d.title,
    titleAr: raw?.titleAr || d.titleAr,
    body: raw?.body || d.body,
    bodyAr: raw?.bodyAr || d.bodyAr,
    updatedAt: raw?.updatedAt ?? 0,
  };
}

export type Block = { kind: "h2" | "h3" | "p"; text: string } | { kind: "ul"; items: string[] };

/** Parses the page text format into blocks (rendered as React elements, never as raw HTML). */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      blocks.push({ kind: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", text: line.slice(3) });
    } else if (/^[-•*] /.test(line)) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") last.items.push(line.slice(2));
      else blocks.push({ kind: "ul", items: [line.slice(2)] });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}
