import { ProductUnit } from "@/lib/types";

export type ClassifiedBeerFormat = "LITER" | "HALF_LITER" | "UNKNOWN";

/** Medio litro antes que “litro” en el nombre; ML/L de Prisma; resto por texto. */
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

  if (unit === ProductUnit.ML) {
    return "HALF_LITER";
  }
  if (unit === ProductUnit.L) {
    return "LITER";
  }

  const isLiterName =
    /\b(de\s+)?litro(s)?\b/.test(n) || /\b1\s*l\b/.test(n) || /\b1000\s*ml\b/.test(n) || /\b(1l)\b/.test(n);

  if (isLiterName) {
    return "LITER";
  }

  return "UNKNOWN";
}

const FORMAT_SORT_ORDER: Record<ClassifiedBeerFormat, number> = {
  HALF_LITER: 0,
  LITER: 1,
  UNKNOWN: 2,
};

export function compareBeerFormatThenName(
  a: { name: string; unit: ProductUnit },
  b: { name: string; unit: ProductUnit },
): number {
  const fa = classifyBeerFormat(a.name, a.unit);
  const fb = classifyBeerFormat(b.name, b.unit);
  const order = FORMAT_SORT_ORDER[fa] - FORMAT_SORT_ORDER[fb];
  if (order !== 0) return order;
  return a.name.localeCompare(b.name, "es");
}

export function beerFormatLabel(format: ClassifiedBeerFormat): string | null {
  if (format === "HALF_LITER") return "½L";
  if (format === "LITER") return "1L";
  return null;
}
