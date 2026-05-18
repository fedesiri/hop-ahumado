import { formatQuantity } from "@/lib/format-currency";
import { ProductUnit } from "@/lib/types";

const DEFAULT_UNITS_PER_BOX = 12;

export type BoxQuantityParts =
  | { kind: "boxes"; sign: "" | "−"; boxes: number; units: number; frac: number }
  | { kind: "other"; sign: "" | "−"; label: string };

export function parseStockQuantity(
  quantity: number | string,
  unit: ProductUnit,
  unitsPerBox: number = DEFAULT_UNITS_PER_BOX,
): BoxQuantityParts {
  if (unit !== ProductUnit.UNIT) {
    const short: Record<ProductUnit, string> = {
      [ProductUnit.UNIT]: "un",
      [ProductUnit.KG]: "kg",
      [ProductUnit.G]: "gr",
      [ProductUnit.L]: "l",
      [ProductUnit.ML]: "ml",
    };
    const n = Number(quantity);
    const sign = Number.isNaN(n) || n >= 0 ? ("" as const) : ("−" as const);
    const label = `${formatQuantity(quantity)} ${short[unit] ?? ""}`.trim();
    return { kind: "other", sign, label };
  }

  const n = Number(quantity);
  if (Number.isNaN(n)) {
    return { kind: "other", sign: "", label: "—" };
  }

  const sign = n < 0 ? ("−" as const) : ("" as const);
  const absWhole = Math.floor(Math.abs(n) + 1e-6);
  const boxes = Math.floor(absWhole / unitsPerBox);
  const units = absWhole % unitsPerBox;
  const frac = Math.abs(n) - absWhole;

  return { kind: "boxes", sign, boxes, units, frac };
}

/** Cantidad en unidades con cajas de 12 u (solo ProductUnit.UNIT). */
export function formatUnitsAsBoxes(
  quantity: number | string,
  unit: ProductUnit,
  unitsPerBox: number = DEFAULT_UNITS_PER_BOX,
): string {
  const parsed = parseStockQuantity(quantity, unit, unitsPerBox);
  if (parsed.kind === "other") {
    return `${parsed.sign}${parsed.label}`;
  }

  const parts: string[] = [];
  if (parsed.boxes > 0) {
    parts.push(`${parsed.boxes} ${parsed.boxes === 1 ? "caja" : "cajas"}`);
  }
  if (parsed.units > 0) {
    parts.push(`${parsed.units} u`);
  }
  if (parts.length === 0 && parsed.frac < 1e-6) {
    parts.push("0 u");
  }
  if (parsed.frac >= 1e-6) {
    parts.push(`${formatQuantity(parsed.frac)} u`);
  }

  return parsed.sign + parts.join(" ");
}
