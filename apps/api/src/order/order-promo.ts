import { BadRequestException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { ORDER_PROMO_CONFIG } from "./order-promo-config";

export type PriceListType = "mayorista" | "minorista" | "fabrica";

type PriceRow = { value: Decimal | number | string; description?: string | null; createdAt?: Date | null };

function normalizeKey(raw: string | null | undefined): string {
  if (raw == null) return "";
  let s = String(raw)
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
  try {
    s = s.normalize("NFD").replace(/\p{M}/gu, "");
  } catch {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return s;
}

function sortPricesNewestFirst(prices: PriceRow[]): PriceRow[] {
  return [...prices].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

function getPriceForType(prices: PriceRow[], priceType: PriceListType): number {
  if (!prices.length) return 0;
  const ordered = sortPricesNewestFirst(prices);
  const typeKey = normalizeKey(priceType);
  const match = ordered.find((p) => normalizeKey(p.description) === typeKey);
  const raw = match ? match.value : ordered[0].value;
  return Number(raw);
}

export const ORDER_PROMO_THRESHOLD_ARS = ORDER_PROMO_CONFIG.thresholdArs;

export function getPromoThresholdCategoryNames(): string[] {
  return [...ORDER_PROMO_CONFIG.thresholdCategoryNames];
}

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

function promoUnitForGiftName(name: string, priceType: PriceListType): number | null {
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

export function countsTowardPromoThreshold(
  product: { name: string; category: { name: string } | null },
  categoryNames: string[],
): boolean {
  if (categoryNames.length > 0) {
    const cat = product.category?.name?.trim() ?? "";
    if (!cat) return false;
    const catKey = normalizeKey(cat);
    return categoryNames.some((token) => normalizeKey(token) === catKey);
  }
  return !isPromoGiftComboName(product.name);
}

export function promoThresholdApplies(priceType: PriceListType, thresholdSubtotal: number): boolean {
  if (priceType === "fabrica") return false;
  return thresholdSubtotal > ORDER_PROMO_CONFIG.thresholdArs;
}

export function effectiveUnitPriceForOrderLine(
  productName: string,
  prices: PriceRow[],
  priceType: PriceListType,
  promoActive: boolean,
): number {
  const list = getPriceForType(prices, priceType);
  if (!promoActive) return list;
  const promo = promoUnitForGiftName(productName, priceType);
  if (promo == null) return list;
  return promo;
}

type OrderLineIn = { productId: string; quantity: number; price: number };

export function validateOrderPromoPricing(params: {
  priceListType: PriceListType;
  items: OrderLineIn[];
  total: number;
  productsById: Map<string, { name: string; category: { name: string } | null }>;
  pricesByProductId: Map<string, PriceRow[]>;
  categoryNames: string[];
  epsilon?: number;
}): void {
  const { priceListType, items, total, productsById, pricesByProductId, categoryNames } = params;
  const eps = params.epsilon ?? 0.02;

  let thresholdSubtotal = 0;
  for (const line of items) {
    const p = productsById.get(line.productId);
    if (!p) continue;
    if (!countsTowardPromoThreshold(p, categoryNames)) continue;
    const prices = pricesByProductId.get(line.productId) ?? [];
    thresholdSubtotal += line.quantity * getPriceForType(prices, priceListType);
  }

  const promoActive = promoThresholdApplies(priceListType, thresholdSubtotal);

  let expectedTotal = 0;
  for (const line of items) {
    const p = productsById.get(line.productId);
    if (!p) {
      throw new BadRequestException(`Producto "${line.productId}" no encontrado para validar precios`);
    }
    const prices = pricesByProductId.get(line.productId) ?? [];
    const expectedUnit = effectiveUnitPriceForOrderLine(p.name, prices, priceListType, promoActive);
    const expectedLine = line.quantity * expectedUnit;
    expectedTotal += expectedLine;
    const unitSent = line.price;
    if (Math.abs(unitSent - expectedUnit) > eps) {
      throw new BadRequestException(
        `Precio de línea inválido para "${p.name}": enviado ${unitSent}, esperado ${expectedUnit} (lista${
          promoActive ? " o promo por umbral" : ""
        })`,
      );
    }
  }

  if (Math.abs(expectedTotal - total) > eps) {
    throw new BadRequestException(`El total (${total}) no coincide con la suma esperada (${expectedTotal.toFixed(2)})`);
  }
}
