import type {
  Category,
  Merchant,
  MerchantOrder,
  Payout,
  Product,
  Provider,
} from "./types";
import { computeSplit } from "./money";
import { DEFAULT_SETTINGS } from "./types";

/**
 * Sample catalog used in demo mode (no Firebase keys) and by `npm run seed`.
 */
const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const demoCategories: Category[] = [
  { id: "fashion", name: "Fashion", slug: "fashion", blurb: "Sneakers, outerwear & daily uniforms", image: u("1610502778270-c5c6f4c7d575"), order: 1 },
  { id: "beauty", name: "Beauty & Fragrance", slug: "beauty", blurb: "Oud, skincare and rituals", image: u("1596462502278-27bfdc403348"), order: 2 },
  { id: "electronics", name: "Electronics", slug: "electronics", blurb: "Audio, wearables & desk tech", image: u("1505740420928-5e560c06d30e"), order: 3 },
  { id: "home", name: "Home & Living", slug: "home", blurb: "Furniture and quiet objects", image: u("1555041469-a586c61ea9bc"), order: 4 },
  { id: "accessories", name: "Accessories", slug: "accessories", blurb: "Watches, eyewear, leather", image: u("1523275335684-37898b6baf30"), order: 5 },
  { id: "pantry", name: "Coffee & Pantry", slug: "pantry", blurb: "Specialty beans & gifting", image: u("1495474472287-4d71bcdd2085"), order: 6 },
];

export const demoMerchants: Merchant[] = [
  { id: "m_atelier", storeName: "Atelier Najd", slug: "atelier-najd", tagline: "Riyadh-made essentials", bio: "Small-batch footwear and outerwear designed in Riyadh.", city: "Riyadh", status: "approved", createdAt: 1730000000000, logoUrl: u("1591047139829-d91aecb6caea", 300) },
  { id: "m_oud", storeName: "Dar Al Oud", slug: "dar-al-oud", tagline: "Fragrance, slowly", bio: "Hand-blended oud and modern perfumery from Jeddah.", city: "Jeddah", status: "approved", createdAt: 1730000000000, logoUrl: u("1781344116880-029945a42b75", 300) },
  { id: "m_circuit", storeName: "Circuit & Co.", slug: "circuit-co", tagline: "Considered technology", bio: "Audio, wearables and desk setups we actually use.", city: "Khobar", status: "approved", createdAt: 1730000000000, logoUrl: u("1505740420928-5e560c06d30e", 300) },
  { id: "m_bayt", storeName: "Bayt Studio", slug: "bayt-studio", tagline: "Objects for slow homes", bio: "Furniture, ceramics and coffee from independent makers.", city: "Riyadh", status: "approved", createdAt: 1730000000000, logoUrl: u("1567538096630-e0c55bd6374c", 300) },
];

const m = Object.fromEntries(demoMerchants.map((x) => [x.id, x]));

function p(
  id: string,
  merchantId: string,
  categoryId: string,
  title: string,
  price: number,
  images: string[],
  description: string,
  compareAtPrice?: number,
): Product {
  return {
    id,
    merchantId,
    merchantName: m[merchantId].storeName,
    merchantSlug: m[merchantId].slug,
    title,
    price,
    compareAtPrice,
    images: images.map((i) => u(i)),
    categoryId,
    description,
    stock: 24,
    status: "active",
    createdAt: 1730000000000,
  };
}

export const demoProducts: Product[] = [
  p("p01", "m_atelier", "accessories", "Weekend Bifold Wallet", 289, ["1627123424574-724758594e93"], "Full-grain leather bifold with six card slots. Darkens beautifully with use.", 349),
  p("p02", "m_atelier", "fashion", "Field Sneaker — Bone", 529, ["1625860191460-10a66c7384fb"], "Low-profile everyday sneaker in full-grain leather with a stitched cupsole."),
  p("p03", "m_atelier", "fashion", "Desert Overshirt", 389, ["1591047139829-d91aecb6caea"], "Heavy cotton twill overshirt, garment-dyed for a lived-in hand-feel."),
  p("p04", "m_atelier", "fashion", "Studio Tee — 3 Pack", 349, ["1610502778270-c5c6f4c7d575"], "Three heavyweight 240gsm cotton tees with a boxy fit. Black, washed black, charcoal."),
  p("p05", "m_oud", "beauty", "Oud Noir Extrait", 890, ["1770048792339-d8f8d8d2dbeb"], "Cambodian oud, smoked leather and saffron. 50ml extrait de parfum.", 1050),
  p("p06", "m_oud", "beauty", "Desert Glow Brush Set", 420, ["1596462502278-27bfdc403348"], "Seven vegan brushes, a bronzer and a rose-gold case for warm, sun-lit looks."),
  p("p07", "m_oud", "beauty", "Rose Taif Body Cream", 310, ["1616750819456-5cdee9b85d22"], "Whipped shea body cream scented with distilled Taif rose and a dry cedar base."),
  p("p08", "m_oud", "beauty", "Ritual Facial Oil", 275, ["1781344116880-029945a42b75"], "Cold-pressed date seed and argan oil serum for desert climates. 30ml dropper."),
  p("p09", "m_atelier", "fashion", "Cloud Crewneck", 249, ["1620799140408-edc6dcb6d633"], "Brushed-back fleece crewneck in undyed cotton. Soft from the first wear."),
  p("p10", "m_circuit", "electronics", "Halo Over-Ear Headphones", 1290, ["1505740420928-5e560c06d30e"], "Adaptive noise cancelling, 40-hour battery and memory-foam cushions.", 1499),
  p("p11", "m_circuit", "electronics", "Pulse Smartwatch", 1150, ["1660844817855-3ecc7ef21f12"], "AMOLED display, heart-rate and sleep tracking, GPS and a week of battery on one charge."),
  p("p12", "m_circuit", "electronics", "Noir Earbuds", 549, ["1606220588913-b3aacb4d2f46"], "Sealed fit, punchy low end and 30 hours of playback with the charging case."),
  p("p13", "m_circuit", "electronics", "Halo Lite Headphones", 749, ["1583394838336-acd977736f90"], "The lighter Halo: folding frame, 50-hour battery and soft protein-leather cushions."),
  p("p14", "m_circuit", "electronics", "Studio Earbuds", 699, ["1655560378428-7605bda51749"], "Tuned dynamic drivers, spatial audio and a pocketable charging case."),
  p("p15", "m_bayt", "home", "Sage Lounge Sofa", 4890, ["1555041469-a586c61ea9bc"], "Three-seater in washed velvet with a solid oak frame. Made to order.", 5600),
  p("p16", "m_bayt", "home", "Arc Lounge Chair", 1690, ["1567538096630-e0c55bd6374c"], "Bent-ply lounge chair with a woven seat. Ships fully assembled."),
  p("p17", "m_bayt", "home", "Oak Stool", 420, ["1503602642458-232111445657"], "Solid oak stool with hand-turned legs and an oiled finish."),
  p("p18", "m_bayt", "home", "Quiet Corner Set", 2350, ["1586023492125-27b2c045efd7"], "Side table, floor lamp and ceramic vessel styled as one set."),
  p("p19", "m_circuit", "accessories", "Minimal Field Watch", 790, ["1523275335684-37898b6baf30"], "38mm brushed steel case, sapphire crystal and a vegetable-tanned strap."),
  p("p20", "m_atelier", "accessories", "Clubline Sunglasses", 340, ["1584036553516-bf83210aa16c"], "Half-rim acetate frame with gradient polarised lenses."),
  p("p21", "m_atelier", "accessories", "Round Acetate Frames", 290, ["1511499767150-a48a237f0083"], "Hand-polished acetate with UV400 lenses and a leather case."),
  p("p22", "m_bayt", "pantry", "Ethiopia Guji Beans", 89, ["1495474472287-4d71bcdd2085"], "Washed heirloom beans — jasmine, peach and black tea. 250g."),
  p("p23", "m_bayt", "pantry", "Pour-Over Kit", 245, ["1509042239860-f550ce710b93"], "Glass dripper, gooseneck kettle and filters in a gift box."),
];

/* ───────────── demo ledger (client only — uses the current time) ───────────── */

const demoCustomers = [
  { firstName: "Sara", lastName: "Al-Qahtani", email: "sara@example.com", phone: "+966500000101", city: "Riyadh", line1: "King Fahd Rd, Olaya" },
  { firstName: "Omar", lastName: "Haddad", email: "omar@example.com", phone: "+966500000102", city: "Jeddah", line1: "Tahlia St" },
  { firstName: "Lina", lastName: "Mansour", email: "lina@example.com", phone: "+966500000103", city: "Khobar", line1: "Prince Turki St" },
  { firstName: "Faisal", lastName: "Al-Harbi", email: "faisal@example.com", phone: "+966500000104", city: "Riyadh", line1: "Tahlia, Al Sulimaniyah" },
  { firstName: "Noura", lastName: "Saleh", email: "noura@example.com", phone: "+966500000105", city: "Dammam", line1: "Al Faisaliyah" },
];

let cache: { orders: MerchantOrder[]; payouts: Payout[] } | null = null;

export function demoLedger() {
  if (cache) return cache;
  const now = Date.now();
  const day = 86_400_000;
  const orders: MerchantOrder[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  for (let i = 0; i < 42; i++) {
    const product = demoProducts[Math.floor(rand() * demoProducts.length)];
    const qty = rand() > 0.8 ? 2 : 1;
    const provider: Provider = rand() > 0.45 ? "tabby" : "tamara";
    const subtotal = product.price * qty;
    const split = computeSplit(subtotal, provider, DEFAULT_SETTINGS);
    const createdAt = now - Math.floor(rand() * 20 * day) - Math.floor(rand() * day);
    const ageDays = (now - createdAt) / day;
    const orderId = `ord${(1000 + i).toString(36)}x${i}`;
    orders.push({
      id: `${orderId}_${product.merchantId}`,
      orderId,
      merchantId: product.merchantId,
      merchantName: product.merchantName,
      customerId: `c${i % 5}`,
      customer: demoCustomers[i % demoCustomers.length],
      items: [
        {
          productId: product.id,
          merchantId: product.merchantId,
          title: product.title,
          image: product.images[0],
          unitPrice: product.price,
          quantity: qty,
          total: subtotal,
        },
      ],
      provider,
      ...split,
      paymentStatus: i % 13 === 5 ? "failed" : "captured",
      fulfillmentStatus: ageDays > 6 ? "delivered" : ageDays > 2 ? "shipped" : "pending",
      payoutStatus: ageDays > 10 ? "paid" : "unpaid",
      payoutId: ageDays > 10 ? `po_${product.merchantId}` : undefined,
      createdAt,
      paidAt: createdAt + 60_000,
    });
  }
  orders.sort((a, b) => b.createdAt - a.createdAt);

  const payouts: Payout[] = demoMerchants.map((mm) => {
    const settled = orders.filter(
      (o) => o.merchantId === mm.id && o.payoutStatus === "paid" && o.paymentStatus === "captured",
    );
    return {
      id: `po_${mm.id}`,
      merchantId: mm.id,
      merchantName: mm.storeName,
      amount: Math.round(settled.reduce((s, o) => s + o.payoutAmount, 0) * 100) / 100,
      merchantOrderIds: settled.map((o) => o.id),
      reference: `TRX-${mm.slug.slice(0, 4).toUpperCase()}-0912`,
      note: "Weekly settlement",
      createdBy: "admin",
      createdAt: now - 10 * day,
    };
  });

  cache = { orders, payouts };
  return cache;
}
