import { ProductUnit } from "@prisma/client";

export type ClassifiedBeerFormat = "LITER" | "HALF_LITER" | "UNKNOWN";

/**
 * Heurística: medio litro antes que “litro” en el nombre; L/ML de Prisma; resto por texto.
 */
export function classifyBeerFormat(name: string, unit: ProductUnit): ClassifiedBeerFormat {
  const n = name.toLowerCase().normalize("NFC");

  const isHalfName =
    /\bmedio\s*litro\b/.test(n) ||
    /\bmedia\s*litro\b/.test(n) ||
    /\b(500|473)\s*(cc|ml|mls)?\b/.test(n) ||
    /\b0[,.]5\s*l?\b/.test(n) ||
    /\b(1\/2|½)\s*l?\b/.test(n);

  if (isHalfName) {
    return "HALF_LITER";
  }

  if (unit === "ML") {
    return "HALF_LITER";
  }
  if (unit === "L") {
    return "LITER";
  }

  const isLiterName =
    /\b(de\s+)?litro(s)?\b/.test(n) || /\b1\s*l\b/.test(n) || /\b1000\s*ml\b/.test(n) || /\b(1l)\b/.test(n);

  if (isLiterName) {
    return "LITER";
  }

  return "UNKNOWN";
}
