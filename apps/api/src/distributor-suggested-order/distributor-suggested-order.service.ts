import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { classifyBeerFormat } from "./beer-format.util";
import { GetDistributorSuggestedOrderQueryDto } from "./dto/get-distributor-suggested-order.query.dto";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface DistributorSuggestedOrderItem {
  productId: string;
  name: string;
  format: "LITER" | "HALF_LITER";
  currentStock: number;
  targetUnits: number;
  targetBoxes: number;
  /** Unidades a pedir (múltiplo de cajas) para acercar el stock al objetivo. */
  suggestedUnits: number;
  suggestedBoxes: number;
  isDeactivated: boolean;
  /**
   * Último costo activo en DB (no desactivado), por unidad. No hay distinción fábrica en el schema;
   * se usa el registro con `createdAt` más reciente.
   */
  unitCost: number | null;
  costRecordedAt: string | null;
  /** suggestedUnits * unitCost cuando aplica. */
  lineApproximateTotal: number | null;
}

export interface DistributorSuggestedOrderUnknown {
  productId: string;
  name: string;
  unit: string;
  currentStock: number;
  isDeactivated: boolean;
}

export interface DistributorSuggestedOrderCostSummary {
  /** Suma de líneas del pedido sugerido que tienen costo. */
  approximateTotal: number;
  orderLinesWithSuggestedUnits: number;
  orderLinesWithCost: number;
  orderLinesMissingCost: number;
  missingCostProductNames: string[];
  /** Explicación breve del criterio (para mostrar al usuario). */
  basis: string;
}

export interface DistributorSuggestedOrderResponse {
  parameters: {
    categoryName: string;
    literTargetBoxes: number;
    halfLiterTargetBoxes: number;
    unitsPerBox: number;
  };
  items: DistributorSuggestedOrderItem[];
  unknownFormat: DistributorSuggestedOrderUnknown[];
  costSummary: DistributorSuggestedOrderCostSummary;
  copyText: string;
}

@Injectable()
export class DistributorSuggestedOrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Por producto, el costo activo con `createdAt` más reciente (históricos vía `deactivatedAt`).
   */
  private async getLatestActiveUnitCostByProductId(
    productIds: string[],
  ): Promise<Map<string, { value: number; createdAt: Date }>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.cost.findMany({
      where: { productId: { in: productIds }, deactivatedAt: null },
      orderBy: { createdAt: "desc" },
      select: { productId: true, value: true, createdAt: true },
    });
    const map = new Map<string, { value: number; createdAt: Date }>();
    for (const r of rows) {
      if (!map.has(r.productId)) {
        map.set(r.productId, { value: Number(r.value), createdAt: r.createdAt });
      }
    }
    return map;
  }

  async getSuggestedOrder(query: GetDistributorSuggestedOrderQueryDto): Promise<DistributorSuggestedOrderResponse> {
    const literTargetBoxes = query.literTargetBoxes ?? 5;
    const halfLiterTargetBoxes = query.halfLiterTargetBoxes ?? 6;
    const unitsPerBox = query.unitsPerBox ?? 12;
    const categoryName = (query.categoryName ?? "Cerveza").trim() || "Cerveza";

    const literTargetUnits = literTargetBoxes * unitsPerBox;
    const halfLiterTargetUnits = halfLiterTargetBoxes * unitsPerBox;

    const products = await this.prisma.product.findMany({
      where: {
        category: { name: { equals: categoryName, mode: "insensitive" } },
      },
      include: { category: true },
    });

    const items: DistributorSuggestedOrderItem[] = [];
    const unknownFormat: DistributorSuggestedOrderUnknown[] = [];

    for (const p of products) {
      const format = classifyBeerFormat(p.name, p.unit);
      const targetUnits = format === "HALF_LITER" ? halfLiterTargetUnits : literTargetUnits;
      const targetBoxes = format === "HALF_LITER" ? halfLiterTargetBoxes : literTargetBoxes;

      const currentStock = Math.max(0, Math.floor(Number(p.stock) || 0));
      const isDeactivated = p.deactivationDate != null;

      if (format === "UNKNOWN") {
        unknownFormat.push({
          productId: p.id,
          name: p.name,
          unit: p.unit,
          currentStock,
          isDeactivated,
        });
        continue;
      }

      const rawGap = Math.max(0, targetUnits - currentStock);
      const suggestedUnits = rawGap === 0 ? 0 : Math.ceil(rawGap / unitsPerBox) * unitsPerBox;
      const suggestedBoxes = suggestedUnits === 0 ? 0 : Math.round(suggestedUnits / unitsPerBox);

      items.push({
        productId: p.id,
        name: p.name,
        format,
        currentStock,
        targetUnits,
        targetBoxes,
        suggestedUnits,
        suggestedBoxes,
        isDeactivated,
        unitCost: null,
        costRecordedAt: null,
        lineApproximateTotal: null,
      });
    }

    const sortKey = (a: DistributorSuggestedOrderItem) => [a.format === "LITER" ? 0 : 1, a.name.toLowerCase()] as const;
    items.sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      return ka[1].localeCompare(kb[1], "es");
    });
    unknownFormat.sort((a, b) => a.name.localeCompare(b.name, "es"));

    const costByProduct = await this.getLatestActiveUnitCostByProductId(items.map((i) => i.productId));
    for (const row of items) {
      const c = costByProduct.get(row.productId);
      if (c) {
        row.unitCost = c.value;
        row.costRecordedAt = c.createdAt.toISOString();
        if (row.suggestedUnits > 0) {
          row.lineApproximateTotal = roundMoney(row.suggestedUnits * c.value);
        }
      }
    }

    const toOrder = items.filter((i) => i.suggestedUnits > 0);
    let approximateTotal = 0;
    const missingCostProductNames: string[] = [];
    for (const row of toOrder) {
      if (row.lineApproximateTotal != null) {
        approximateTotal += row.lineApproximateTotal;
      } else {
        missingCostProductNames.push(row.name);
      }
    }
    approximateTotal = roundMoney(approximateTotal);
    const orderLinesWithCost = toOrder.filter((r) => r.lineApproximateTotal != null).length;
    const costSummary: DistributorSuggestedOrderCostSummary = {
      approximateTotal,
      orderLinesWithSuggestedUnits: toOrder.length,
      orderLinesWithCost,
      orderLinesMissingCost: missingCostProductNames.length,
      missingCostProductNames,
      basis:
        "Costo unitario: último registro de costo activo (no desactivado) por producto, por fecha de registro.",
    };

    const lines: string[] = [];
    const header = `Pedido sugerido — ${categoryName} (${new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })})`;
    lines.push(header);
    lines.push(
      `Reglas: litro → ${literTargetBoxes} cajas (${literTargetUnits} u); medio litro → ${halfLiterTargetBoxes} cajas (${halfLiterTargetUnits} u); caja = ${unitsPerBox} u.`,
    );
    lines.push("");

    if (toOrder.length === 0) {
      lines.push("(Nada que pedir: todo en o por encima del stock objetivo.)");
    } else {
      for (const row of toOrder) {
        const tag = row.format === "LITER" ? "1L" : "½L";
        const deact = row.isDeactivated ? " [baja]" : "";
        const costBit =
          row.lineApproximateTotal != null
            ? ` — ~$${row.lineApproximateTotal.toLocaleString("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
            : " — (sin costo activo registrado)";
        lines.push(
          `• ${row.name} (${tag})${deact}: ${row.suggestedUnits} u (${row.suggestedBoxes} cj)${costBit}`,
        );
      }
      lines.push("");
      lines.push(
        `Costo aprox. total (suma de líneas con costo): $${approximateTotal.toLocaleString("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`,
      );
      if (missingCostProductNames.length > 0) {
        lines.push(
          `Sin costo activo (no sumados): ${missingCostProductNames.join(", ")}`,
        );
      }
    }

    if (unknownFormat.length > 0) {
      lines.push("");
      lines.push("Sin clasificar 1L/½L (revisar nombre o unidad del producto):");
      for (const u of unknownFormat) {
        const deact = u.isDeactivated ? " [baja]" : "";
        lines.push(`• ${u.name} (${u.unit})${deact} — stock ${u.currentStock} u`);
      }
    }

    const copyText = lines.join("\n");

    return {
      parameters: {
        categoryName,
        literTargetBoxes,
        halfLiterTargetBoxes,
        unitsPerBox,
      },
      items,
      unknownFormat,
      costSummary,
      copyText,
    };
  }
}
