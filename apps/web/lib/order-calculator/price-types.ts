/**
 * Tipos de precio para la calculadora. Los precios en BD (Price.description)
 * pueden coincidir con estos valores para mostrar mayorista/minorista/fábrica.
 */

export type PriceType = "mayorista" | "minorista" | "fabrica";

export const PRICE_TYPES: PriceType[] = ["mayorista", "minorista", "fabrica"];

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  mayorista: "Mayorista",
  minorista: "Minorista",
  fabrica: "Fabrica",
};

/** Precio con description opcional (como viene de la API) */
export interface PriceLike {
  value: number;
  description?: string | null;
}

/**
 * Devuelve el valor de precio para el tipo seleccionado.
 * Busca un precio cuya description coincida con el tipo (ej. "mayorista");
 * si no hay, usa el primer precio del producto como fallback.
 */
export function getPriceForType(prices: PriceLike[], priceType: PriceType): number {
  if (!prices.length) return 0;
  const match = prices.find((p) => p.description?.trim().toLowerCase() === priceType.trim().toLowerCase());
  if (match) return match.value;
  return prices[0].value;
}
