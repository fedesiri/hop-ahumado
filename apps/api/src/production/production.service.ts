import { BadRequestException, Injectable } from "@nestjs/common";
import { StockMovementType } from "@prisma/client";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductionDto } from "./dto/create-production.dto";

/** YYYY-MM-DD → mediodía UTC de ese día (evita corrimientos de zona horaria). */
function movementDate(date?: string): Date | undefined {
  return date ? new Date(`${date}T12:00:00.000Z`) : undefined;
}

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Productos que se pueden producir en la línea: bases de preparación (cocción) y productos marcados
   * como "producidos antes de vender", siempre que tengan receta. Cada uno trae su receta como guía
   * (cantidades por 1 unidad producida) y, si es una cocción, el ingrediente principal y la merma.
   */
  async templates(businessLineId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        businessLineId,
        deactivationDate: null,
        recipeItems: { some: {} },
        OR: [{ producedToStock: true }, { recipeCostProfile: { recipeType: "PREPARACION_BASE" } }],
      },
      include: {
        recipeCostProfile: true,
        recipeItems: { include: { ingredient: { select: { id: true, name: true, unit: true, stock: true, recipeCostProfile: { select: { recipeType: true } } } } } },
      },
      orderBy: { name: "asc" },
    });
    return products.map((p) => {
      const profile = p.recipeCostProfile;
      const isCooking = !!profile?.mainIngredientId && (profile.cookingLossPct ?? 0) > 0;
      // Preparaciones (ej. relleno) que se arman a partir de una base: el insumo "motor" es esa base.
      const driver = isCooking
        ? null
        : [...p.recipeItems]
            .filter((r) => r.ingredient.recipeCostProfile?.recipeType === "PREPARACION_BASE")
            .sort((a, b) => b.quantity - a.quantity)[0];
      return {
        id: p.id,
        name: p.name,
        driverIngredientId: driver?.ingredientId ?? null,
        unit: p.unit,
        stock: p.stock,
        isCooking,
        mainIngredientId: isCooking ? profile!.mainIngredientId : null,
        cookingLossPct: isCooking ? profile!.cookingLossPct : 0,
        items: p.recipeItems
          .map((r) => ({
            productId: r.ingredientId,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            stock: r.ingredient.stock,
            perUnit: r.quantity,
          }))
          .sort((a, b) => b.perUnit - a.perUnit),
      };
    });
  }

  /**
   * Registra una producción: descuenta los insumos realmente usados y suma el producto obtenido,
   * todo en una transacción. Queda un movimiento de stock por cada insumo y uno por el producto.
   */
  async create(dto: CreateProductionDto) {
    const ids = dto.inputs.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Hay un insumo repetido");
    }
    if (ids.includes(dto.productId)) {
      throw new BadRequestException("El producto producido no puede ser insumo de sí mismo");
    }
    if (dto.inputs.length === 0) {
      throw new BadRequestException("Cargá al menos un insumo");
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, name: true, businessLineId: true },
      });
      if (!product) throw new BadRequestException("Producto no encontrado");
      const found = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (found.length !== ids.length) throw new BadRequestException("Algún insumo no existe");

      const locationId = dto.locationId ?? (await this.inventory.getDefaultLocationId(tx, product.businessLineId));
      const createdAt = movementDate(dto.date);
      const reason = `Producción: ${product.name}${dto.notes?.trim() ? ` (${dto.notes.trim()})` : ""}`;

      for (const input of dto.inputs) {
        await this.inventory.applyBalanceDelta(tx, input.productId, locationId, -input.quantity);
        await tx.stockMovement.create({
          data: { productId: input.productId, quantity: input.quantity, type: StockMovementType.OUT, reason, locationId, createdAt },
        });
      }
      await this.inventory.applyBalanceDelta(tx, product.id, locationId, dto.quantity);
      await tx.stockMovement.create({
        data: { productId: product.id, quantity: dto.quantity, type: StockMovementType.IN, reason, locationId, createdAt },
      });

      const out = await tx.product.findUnique({ where: { id: product.id }, select: { id: true, name: true, stock: true } });
      return { product: out, inputs: dto.inputs.length };
    });
  }
}
