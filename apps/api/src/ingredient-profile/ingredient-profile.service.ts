import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { CostService } from "../cost/cost.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertIngredientProfileDto } from "./dto/upsert-ingredient-profile.dto";

export type IngredientEstado = "ACTIVO" | "SIN_PRECIO" | "SIN_USO" | "SIN_PRECIO_SIN_USO";

export type IngredientProfileRow = {
  productId: string;
  name: string;
  unit: string;
  categoryId: string | null;
  categoryName: string | null;
  deactivationDate: Date | null;
  unitCost: number | null;
  purchaseQuantity: number | null;
  purchasePrice: number | null;
  supplier: string | null;
  notes: string | null;
  estado: IngredientEstado;
};

@Injectable()
export class IngredientProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costService: CostService,
  ) {}

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    businessLineId?: string,
    search?: string,
    categoryId?: string,
    includeDeactivated = false,
  ): Promise<PaginatedResponse<IngredientProfileRow>> {
    const where: Prisma.ProductWhereInput = { recipeCostProfile: null };
    if (businessLineId) where.businessLineId = businessLineId;
    if (categoryId) where.categoryId = categoryId;
    if (!includeDeactivated) where.deactivationDate = null;
    const trimmed = search?.trim();
    if (trimmed) {
      where.OR = [
        { name: { contains: trimmed, mode: "insensitive" } },
        { sku: { contains: trimmed, mode: "insensitive" } },
        { barcode: { contains: trimmed, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          ingredientProfile: true,
          costs: { where: { deactivatedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const productIds = products.map((p) => p.id);
    const usageCounts = productIds.length
      ? await this.prisma.recipeItem.groupBy({
          by: ["ingredientId"],
          where: { ingredientId: { in: productIds } },
          _count: { _all: true },
        })
      : [];
    const usageByProductId = new Map(usageCounts.map((u) => [u.ingredientId, u._count._all]));

    const data = products.map((p) => {
      const unitCost = p.costs[0] ? Number(p.costs[0].value) : null;
      const usedCount = usageByProductId.get(p.id) ?? 0;
      const noPrice = unitCost == null;
      const noUse = usedCount === 0;
      const estado: IngredientEstado =
        noPrice && noUse ? "SIN_PRECIO_SIN_USO" : noPrice ? "SIN_PRECIO" : noUse ? "SIN_USO" : "ACTIVO";
      return {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        categoryId: p.category?.id ?? null,
        categoryName: p.category?.name ?? null,
        deactivationDate: p.deactivationDate,
        unitCost,
        purchaseQuantity: p.ingredientProfile?.purchaseQuantity ?? null,
        purchasePrice: p.ingredientProfile?.purchasePrice != null ? Number(p.ingredientProfile.purchasePrice) : null,
        supplier: p.ingredientProfile?.supplier ?? null,
        notes: p.ingredientProfile?.notes ?? null,
        estado,
      };
    });

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(productId: string): Promise<IngredientProfileRow> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true } },
        ingredientProfile: true,
        costs: { where: { deactivatedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!product) {
      throw new NotFoundException(`Producto con id "${productId}" no encontrado`);
    }
    const usedCount = await this.prisma.recipeItem.count({ where: { ingredientId: productId } });
    const unitCost = product.costs[0] ? Number(product.costs[0].value) : null;
    const noPrice = unitCost == null;
    const noUse = usedCount === 0;
    const estado: IngredientEstado =
      noPrice && noUse ? "SIN_PRECIO_SIN_USO" : noPrice ? "SIN_PRECIO" : noUse ? "SIN_USO" : "ACTIVO";
    return {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      categoryId: product.category?.id ?? null,
      categoryName: product.category?.name ?? null,
      deactivationDate: product.deactivationDate,
      unitCost,
      purchaseQuantity: product.ingredientProfile?.purchaseQuantity ?? null,
      purchasePrice:
        product.ingredientProfile?.purchasePrice != null ? Number(product.ingredientProfile.purchasePrice) : null,
      supplier: product.ingredientProfile?.supplier ?? null,
      notes: product.ingredientProfile?.notes ?? null,
      estado,
    };
  }

  /** Crea o actualiza el perfil de ingrediente de un producto y sincroniza su Costo si vienen cantidad y precio de compra. */
  async upsert(productId: string, dto: UpsertIngredientProfileDto): Promise<IngredientProfileRow> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new BadRequestException(`Producto con id "${productId}" no encontrado`);
    }

    await this.prisma.ingredientProfile.upsert({
      where: { productId },
      create: {
        productId,
        purchaseQuantity: dto.purchaseQuantity,
        purchasePrice: dto.purchasePrice != null ? new Decimal(dto.purchasePrice) : undefined,
        supplier: dto.supplier,
        notes: dto.notes,
      },
      update: {
        ...(dto.purchaseQuantity !== undefined && { purchaseQuantity: dto.purchaseQuantity }),
        ...(dto.purchasePrice !== undefined && {
          purchasePrice: dto.purchasePrice != null ? new Decimal(dto.purchasePrice) : null,
        }),
        ...(dto.supplier !== undefined && { supplier: dto.supplier }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    if (dto.purchasePrice === null) {
      const existingCost = await this.prisma.cost.findFirst({
        where: { productId, deactivatedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (existingCost) {
        await this.costService.remove(existingCost.id);
      }
    }

    if (dto.purchaseQuantity != null && dto.purchasePrice != null && dto.purchaseQuantity > 0) {
      const unitCost = dto.purchasePrice / dto.purchaseQuantity;
      const existingCost = await this.prisma.cost.findFirst({
        where: { productId, deactivatedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (existingCost) {
        await this.costService.replace(existingCost.id, { value: unitCost }, { allowIngredientTracked: true });
      } else {
        await this.costService.create({ productId, value: unitCost }, { allowIngredientTracked: true });
      }
    }

    return this.findOne(productId);
  }
}
