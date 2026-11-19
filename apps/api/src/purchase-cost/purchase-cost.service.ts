import { Injectable } from "@nestjs/common";
import { CostService } from "../cost/cost.service";
import { IngredientProfileService } from "../ingredient-profile/ingredient-profile.service";
import { PrismaService } from "../prisma/prisma.service";

export type PurchaseCostOutcome =
  | { productId: string; kind: "updated"; from: number | null; to: number }
  | { productId: string; kind: "skipped"; note: string };

/**
 * Actualiza el costo por unidad de un producto con lo que costó una compra (importe / cantidad).
 * Lo usan Flujo de caja (gasto con productos de stock) y Stock (entrada), para que se comporten igual.
 */
@Injectable()
export class PurchaseCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costs: CostService,
    private readonly ingredientProfiles: IngredientProfileService,
  ) {}

  async applyMany(items: { productId: string; quantity: number; amount: number }[]): Promise<PurchaseCostOutcome[]> {
    const out: PurchaseCostOutcome[] = [];
    for (const item of items) {
      try {
        out.push(await this.apply(item.productId, item.amount, item.quantity));
      } catch (e) {
        out.push({
          productId: item.productId,
          kind: "skipped",
          note: `No se pudo actualizar el costo: ${e instanceof Error ? e.message : "error"}`,
        });
      }
    }
    return out;
  }

  /** Respeta cómo se mantiene el costo de cada producto (receta, ingrediente con precio de compra, o costo simple). */
  async apply(productId: string, paid: number, quantity: number): Promise<PurchaseCostOutcome> {
    const unitCost = Math.round((paid / quantity) * 100) / 100;
    if (!(unitCost > 0)) return { productId, kind: "skipped", note: "El importe no permite calcular un costo" };

    const recipe = await this.prisma.recipeCostProfile.findUnique({ where: { productId } });
    if (recipe) {
      return { productId, kind: "skipped", note: "Es una receta: su costo se calcula solo desde sus ingredientes" };
    }
    const current = await this.prisma.cost.findFirst({
      where: { productId, deactivatedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const from = current ? Number(current.value) : null;
    if (from !== null && Math.abs(from - unitCost) < 0.005) {
      return { productId, kind: "skipped", note: "El costo ya era ese" };
    }

    const ingredient = await this.prisma.ingredientProfile.findUnique({ where: { productId } });
    if (ingredient) {
      // El costo sale de cantidad y precio de compra: se actualizan esos datos y el costo se recalcula.
      await this.ingredientProfiles.upsert(productId, { purchaseQuantity: quantity, purchasePrice: paid });
    } else if (current) {
      await this.costs.replace(current.id, { value: unitCost });
    } else {
      await this.costs.create({ productId, value: unitCost });
    }
    return { productId, kind: "updated", from, to: unitCost };
  }
}
