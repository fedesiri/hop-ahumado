import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cost, Prisma } from "@prisma/client";
import { COSTING_INPUTS_CHANGED } from "../common/costing-events";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { BulkReplaceCostDto } from "./dto/bulk-replace-cost.dto";
import { CreateCostDto } from "./dto/create-cost.dto";
import { ReplaceCostDto } from "./dto/replace-cost.dto";
import { UpdateCostDto } from "./dto/update-cost.dto";

type CostWriteOpts = {
  allowIngredientTracked?: boolean;
  /** Escritura de RecipeCostSyncService: permite recetas y no vuelve a disparar la sincronización. */
  fromRecipeSync?: boolean;
};

@Injectable()
export class CostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCostDto, opts?: CostWriteOpts) {
    await this.validateProductExists(dto.productId);
    if (!opts?.allowIngredientTracked) await this.assertNotIngredientTracked(dto.productId);
    if (!opts?.fromRecipeSync) await this.assertNotRecipeTracked(dto.productId);
    const created = await this.prisma.$transaction(async (tx) => {
      const cost = await tx.cost.create({
        data: { productId: dto.productId, value: dto.value },
        include: { product: true },
      });
      await this.syncFabricaPrice(tx, dto.productId, dto.value);
      return cost;
    });
    await this.notifyCostingInputsChanged(opts);
    return created;
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    productId?: string,
    activeOnly = false,
    search?: string,
    businessLineId?: string,
  ): Promise<PaginatedResponse<Cost & { product: { id: string; name: string } }>> {
    const where: Prisma.CostWhereInput = {};
    if (productId) where.productId = productId;
    if (activeOnly) where.deactivatedAt = null;

    const productFilter: Prisma.ProductWhereInput = {};
    if (businessLineId) productFilter.businessLineId = businessLineId;

    const trimmed = search?.trim();
    if (trimmed) {
      productFilter.OR = [
        { name: { contains: trimmed, mode: "insensitive" } },
        { sku: { contains: trimmed, mode: "insensitive" } },
        { barcode: { contains: trimmed, mode: "insensitive" } },
      ];
    }

    if (Object.keys(productFilter).length > 0) where.product = productFilter;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.cost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { id: true, name: true } } },
        skip,
        take: limit,
      }),
      this.prisma.cost.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const cost = await this.prisma.cost.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!cost) {
      throw new NotFoundException(`Costo con id "${id}" no encontrado`);
    }
    return cost;
  }

  async update(id: string, dto: UpdateCostDto, opts?: CostWriteOpts) {
    const existing = await this.findOne(id);
    if (dto.productId !== undefined) {
      await this.validateProductExists(dto.productId);
    }
    if (dto.value !== undefined && !opts?.allowIngredientTracked) {
      await this.assertNotIngredientTracked(existing.productId);
    }
    if (dto.value !== undefined && !opts?.fromRecipeSync) {
      await this.assertNotRecipeTracked(existing.productId);
    }
    const data: { productId?: string; value?: number; deactivatedAt?: Date | null } = {};
    if (dto.productId !== undefined) data.productId = dto.productId;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.deactivatedAt !== undefined) {
      data.deactivatedAt = dto.deactivatedAt === null ? null : new Date(dto.deactivatedAt);
    }
    const updated =
      dto.value !== undefined
        ? await this.prisma.$transaction(async (tx) => {
            const cost = await tx.cost.update({ where: { id }, data, include: { product: true } });
            await this.syncFabricaPrice(tx, existing.productId, dto.value!);
            return cost;
          })
        : await this.prisma.cost.update({ where: { id }, data, include: { product: true } });
    await this.notifyCostingInputsChanged(opts);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    const removed = await this.prisma.cost.update({
      where: { id },
      data: { deactivatedAt: new Date() },
      include: { product: true },
    });
    await this.notifyCostingInputsChanged();
    return removed;
  }

  /**
   * Para cada producto involucrado: desactiva todos los costos seleccionados de ese producto
   * y crea un único costo nuevo (mismo valor para todos).
   */
  async bulkReplace(dto: BulkReplaceCostDto) {
    const uniqueIds = [...new Set(dto.costIds)];
    const records = await this.prisma.cost.findMany({ where: { id: { in: uniqueIds } } });
    if (records.length !== uniqueIds.length) {
      throw new BadRequestException("Uno o más costos no existen");
    }
    for (const c of records) {
      if (c.deactivatedAt) {
        throw new BadRequestException("Algún costo seleccionado ya está archivado");
      }
    }
    for (const productId of new Set(records.map((c) => c.productId))) {
      await this.assertNotIngredientTracked(productId);
      await this.assertNotRecipeTracked(productId);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const byProduct = new Map<string, string[]>();
      for (const c of records) {
        const list = byProduct.get(c.productId) ?? [];
        list.push(c.id);
        byProduct.set(c.productId, list);
      }

      const created = [];
      for (const [productId, costRowIds] of byProduct) {
        for (const id of costRowIds) {
          await tx.cost.update({
            where: { id },
            data: { deactivatedAt: new Date() },
          });
        }
        const row = await tx.cost.create({
          data: { productId, value: dto.value },
          include: { product: { select: { id: true, name: true } } },
        });
        await this.syncFabricaPrice(tx, productId, dto.value);
        created.push(row);
      }

      return { count: created.length, costs: created };
    });
    await this.notifyCostingInputsChanged();
    return result;
  }

  /**
   * Desactiva el costo indicado y crea uno nuevo para el mismo producto (historial preservado).
   */
  async replace(id: string, dto: ReplaceCostDto, opts?: CostWriteOpts) {
    const target = await this.prisma.cost.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`Costo con id "${id}" no encontrado`);
    }
    if (!opts?.allowIngredientTracked) await this.assertNotIngredientTracked(target.productId);
    if (!opts?.fromRecipeSync) await this.assertNotRecipeTracked(target.productId);

    const replaced = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cost.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Costo con id "${id}" no encontrado`);
      }
      if (existing.deactivatedAt) {
        throw new BadRequestException("Este costo ya está archivado; usá crear costo nuevo o editá uno activo.");
      }

      await tx.cost.update({
        where: { id },
        data: { deactivatedAt: new Date() },
      });

      const cost = await tx.cost.create({
        data: { productId: existing.productId, value: dto.value },
        include: { product: { select: { id: true, name: true } } },
      });
      await this.syncFabricaPrice(tx, existing.productId, dto.value);
      return cost;
    });
    await this.notifyCostingInputsChanged(opts);
    return replaced;
  }

  /** Recalcula el costo de las recetas que usan estos costos (ver RecipeCostSyncService). */
  private async notifyCostingInputsChanged(opts?: CostWriteOpts) {
    if (opts?.fromRecipeSync) return;
    await this.eventEmitter.emitAsync(COSTING_INPUTS_CHANGED);
  }

  private async syncFabricaPrice(tx: Prisma.TransactionClient, productId: string, value: number): Promise<void> {
    const existing = await tx.price.findFirst({
      where: {
        productId,
        deactivatedAt: null,
        OR: [
          { description: { equals: "fabrica", mode: "insensitive" } },
          { description: { equals: "fábrica", mode: "insensitive" } },
        ],
      },
    });
    if (existing) {
      await tx.price.update({ where: { id: existing.id }, data: { deactivatedAt: new Date() } });
    }
    await tx.price.create({ data: { productId, value, description: "fabrica" } });
  }

  /**
   * Un producto con IngredientProfile deriva su costo de cantidad/precio de compra
   * (ver IngredientProfileService.upsert). Editar su Cost por fuera de esa pantalla
   * desincroniza esos dos campos del costo unitario real: bloqueado.
   */
  private async assertNotIngredientTracked(productId: string) {
    const profile = await this.prisma.ingredientProfile.findUnique({ where: { productId } });
    if (profile) {
      throw new BadRequestException(
        "Este producto tiene cantidad y precio de compra cargados en Ingredientes. Editá el costo desde esa pantalla para no desincronizar los datos.",
      );
    }
  }

  /** El Cost de una receta lo calcula y guarda RecipeCostSyncService: una edición manual se pisaría. */
  private async assertNotRecipeTracked(productId: string) {
    const profile = await this.prisma.recipeCostProfile.findUnique({ where: { productId } });
    if (profile) {
      throw new BadRequestException(
        "Este producto es una receta: su costo se calcula desde Recetas y se actualiza solo.",
      );
    }
  }

  private async validateProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new BadRequestException(`Producto con id "${productId}" no encontrado`);
    }
  }
}
