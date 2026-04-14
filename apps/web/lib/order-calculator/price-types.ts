/**
 * Tipos de precio para la pantalla Nueva orden. Los precios en BD (Price.description)
 * pueden coincidir con estos valores para mostrar mayorista/minorista/fábrica.
 */

export type PriceType = "mayorista" | "minorista" | "fabrica";

export const PRICE_TYPES: PriceType[] = ["mayorista", "minorista", "fabrica"];

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  mayorista: "Mayorista",
  minorista: "Minorista",
  fabrica: "Fabrica",
};

/** Precio con description opcional (como viene de la API; value puede venir como number o string) */
export interface PriceLike {
  value: number | string;
  description?: string | null;
  createdAt?: string;
}

/**
 * Clave comparable para lista de precios: minúsculas, sin acentos (ej. BD "Fábrica" === selector "fabrica"),
 * sin espacios raros ni zero-width.
 */
export function normalizePriceListKey(raw: string | null | undefined): string {
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

function sortPricesNewestFirst(prices: PriceLike[]): PriceLike[] {
  return [...prices].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Devuelve el valor de precio para el tipo seleccionado (siempre como number).
 * Busca un precio cuya description coincida con el tipo (mayorista / minorista / fabrica), con
 * comparación flexible (acentos, mayúsculas). Si no hay coincidencia, usa el precio activo más reciente.
 */
export function getPriceForType(prices: PriceLike[], priceType: PriceType): number {
  if (!prices.length) return 0;
  const ordered = sortPricesNewestFirst(prices);
  const typeKey = normalizePriceListKey(priceType);
  const match = ordered.find((p) => normalizePriceListKey(p.description) === typeKey);
  const raw = match ? match.value : ordered[0].value;
  return Number(raw);
}

const PRICE_MATCH_EPS = 0.02;

/**
 * Adivina qué tipo de precio (lista) se usó al armar el pedido, comparando cada línea
 * con los precios actuales del producto. Sirve para abrir la edición con el mismo selector que al crear.
 */
export function inferPriceTypeFromOrderLines(
  items: { productId: string; price: number | string }[],
  pricesByProductId: Record<string, PriceLike[]>,
): PriceType {
  if (!items.length) return "mayorista";

  const votes: Record<PriceType, number> = { mayorista: 0, minorista: 0, fabrica: 0 };

  for (const item of items) {
    const prices = pricesByProductId[item.productId] ?? [];
    if (!prices.length) continue;

    const line = Number(item.price);
    const matches = PRICE_TYPES.filter((t) => Math.abs(getPriceForType(prices, t) - line) < PRICE_MATCH_EPS);

    if (matches.length === 1) {
      votes[matches[0]]++;
    } else if (matches.length > 1) {
      let best: PriceType = matches[0];
      let bestDist = Infinity;
      for (const t of matches) {
        const d = Math.abs(getPriceForType(prices, t) - line);
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      votes[best]++;
    }
  }

  const totalVotes = votes.mayorista + votes.minorista + votes.fabrica;
  if (totalVotes === 0) return "mayorista";

  let winner: PriceType = "mayorista";
  let max = -1;
  for (const t of PRICE_TYPES) {
    if (votes[t] > max) {
      max = votes[t];
      winner = t;
    }
  }
  return winner;
}
