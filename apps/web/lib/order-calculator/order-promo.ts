import { ORDER_PROMO_CONFIG } from "@/lib/order-calculator/order-promo-config";
import { getPriceForType, normalizePriceListKey, type PriceType } from "@/lib/order-calculator/price-types";
import type { Price, Product } from "@/lib/types";

export { ORDER_PROMO_CONFIG } from "@/lib/order-calculator/order-promo-config";

/** Re-export: umbral en ARS (subtotal que dispara la promo). */
export const ORDER_PROMO_THRESHOLD_ARS = ORDER_PROMO_CONFIG.thresholdArs;

/** Categorías que suman al umbral (copia mutable para quien lo necesite). */
export function getPromoThresholdCategoryNames(): string[] {
  return [...ORDER_PROMO_CONFIG.thresholdCategoryNames];
}

/** Nombre de producto comparable para detectar combos regalo (Estuche/Copa, etc.). */
export function normalizeGiftComboName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
}

export function isPromoGiftComboName(name: string): boolean {
  const n = normalizeGiftComboName(name);
  return n === "estuche/copa" || n === "estuche/vaso";
}

function promoUnitForGiftName(name: string, priceType: PriceType): number | null {
  if (priceType === "fabrica") return null;
  const key = normalizeGiftComboName(name);
  const copa = ORDER_PROMO_CONFIG.promoUnitMayoristaMinoristaEstucheCopa;
  const vaso = ORDER_PROMO_CONFIG.promoUnitMayoristaMinoristaEstucheVaso;
  const table: Record<string, { mayorista: number; minorista: number }> = {
    "estuche/copa": { mayorista: copa, minorista: copa },
    "estuche/vaso": { mayorista: vaso, minorista: vaso },
  };
  const row = table[key];
  if (!row) return null;
  return row[priceType];
}

/** Si el producto aporta al subtotal que se compara con el umbral (siempre con precio de lista). */
export function countsTowardPromoThreshold(
  product: Pick<Product, "name" | "category">,
  categoryNames: string[],
): boolean {
  if (categoryNames.length > 0) {
    const cat = product.category?.name?.trim() ?? "";
    if (!cat) return false;
    const catKey = normalizePriceListKey(cat);
    return categoryNames.some((token) => normalizePriceListKey(token) === catKey);
  }
  return !isPromoGiftComboName(product.name);
}

export function computePromoThresholdSubtotal(
  products: Product[],
  quantities: Record<string, number>,
  pricesByProductId: Record<string, Price[]>,
  priceType: PriceType,
  categoryNames: string[],
): number {
  let sum = 0;
  for (const p of products) {
    const qty = quantities[p.id] ?? 0;
    if (qty <= 0) continue;
    if (!countsTowardPromoThreshold(p, categoryNames)) continue;
    const prices = pricesByProductId[p.id] ?? [];
    sum += qty * getPriceForType(prices, priceType);
  }
  return sum;
}

export function promoThresholdApplies(priceType: PriceType, thresholdSubtotal: number): boolean {
  if (priceType === "fabrica") return false;
  return thresholdSubtotal > ORDER_PROMO_CONFIG.thresholdArs;
}

/** Precio unitario de venta (lista o promo si corresponde). */
export function effectiveUnitPriceForOrderLine(
  product: Pick<Product, "name">,
  prices: Price[],
  priceType: PriceType,
  promoActive: boolean,
): number {
  const list = getPriceForType(prices, priceType);
  if (!promoActive) return list;
  const promo = promoUnitForGiftName(product.name, priceType);
  if (promo == null) return list;
  return promo;
}

export function computeOrderTotalWithPromo(
  products: Product[],
  quantities: Record<string, number>,
  pricesByProductId: Record<string, Price[]>,
  priceType: PriceType,
  categoryNames: string[],
): { total: number; thresholdSubtotal: number; promoActive: boolean } {
  const thresholdSubtotal = computePromoThresholdSubtotal(
    products,
    quantities,
    pricesByProductId,
    priceType,
    categoryNames,
  );
  const promoActive = promoThresholdApplies(priceType, thresholdSubtotal);
  let total = 0;
  for (const p of products) {
    const qty = quantities[p.id] ?? 0;
    if (qty <= 0) continue;
    const prices = pricesByProductId[p.id] ?? [];
    const unit = effectiveUnitPriceForOrderLine(p, prices, priceType, promoActive);
    total += qty * unit;
  }
  return { total, thresholdSubtotal, promoActive };
}
