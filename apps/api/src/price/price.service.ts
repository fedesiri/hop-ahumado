import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Price, Prisma } from "@prisma/client";
import { COSTING_INPUTS_CHANGED } from "../common/costing-events";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { BulkReplacePriceDto } from "./dto/bulk-replace-price.dto";
import { CreatePriceDto } from "./dto/create-price.dto";
import { ReplacePriceDto } from "./dto/replace-price.dto";
import { UpdatePriceDto } from "./dto/update-price.dto";

function isFabricaList(description: string | null | undefined): boolean {
  return (
    (description ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "fabrica"
  );
}

@Injectable()
export class PriceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreatePriceDto) {
    await this.validateProductExists(dto.productId);
    await this.assertChannelSellable(dto.productId, dto.description);
    const fabrica = isFabricaList(dto.description);
    if (fabrica) await this.assertFabricaEditable(dto.productId);
    const created = await this.prisma.$transaction(async (tx) => {
      const price = await tx.price.create({
        data: {
          productId: dto.productId,
          value: dto.value,
          description: dto.description ?? undefined,
        },
        include: { product: true },
      });
      if (fabrica) await this.syncCostFromFabrica(tx, dto.productId, dto.value);
      return price;
    });
    if (fabrica) await this.notifyCostingInputsChanged();
    return created;
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    productId?: string,
    activeOnly = false,
    search?: string,
    listType?: string,
    businessLineId?: string,
  ): Promise<PaginatedResponse<Price & { product: { id: string; name: string } }>> {
    const andParts: Prisma.PriceWhereInput[] = [];
    if (productId) {
      andParts.push({ productId });
    }
    if (activeOnly) {
      andParts.push({ deactivatedAt: null });
    }

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
    if (Object.keys(productFilter).length > 0) {
      andParts.push({ product: productFilter });
    }

    const lt = listType?.trim().toLowerCase();
    if (lt === "mayorista" || lt === "minorista" || lt === "catering") {
      andParts.push({ description: { equals: lt, mode: "insensitive" } });
    } else if (lt === "fabrica") {
      andParts.push({
        OR: [
          { description: { equals: "fabrica", mode: "insensitive" } },
          { description: { equals: "fábrica", mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.PriceWhereInput = andParts.length === 0 ? {} : { AND: andParts };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.price.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { id: true, name: true } } },
        skip,
        take: limit,
      }),
      this.prisma.price.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const price = await this.prisma.price.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!price) {
      throw new NotFoundException(`Precio con id "${id}" no encontrado`);
    }
    return price;
  }

  async update(id: string, dto: UpdatePriceDto) {
    const existing = await this.findOne(id);
    if (dto.productId !== undefined) {
      await this.validateProductExists(dto.productId);
    }
    if (dto.value !== undefined || dto.description !== undefined || dto.productId !== undefined) {
      await this.assertChannelSellable(dto.productId ?? existing.productId, dto.description ?? existing.description);
    }
    const data: {
      productId?: string;
      value?: number;
      description?: string;
      deactivatedAt?: Date | null;
    } = {};
    if (dto.productId !== undefined) data.productId = dto.productId;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.deactivatedAt !== undefined) {
      data.deactivatedAt = dto.deactivatedAt === null ? null : new Date(dto.deactivatedAt);
    }
    const finalProductId = dto.productId ?? existing.productId;
    const finalDescription = dto.description ?? existing.description;
    const stillActive = data.deactivatedAt !== undefined ? data.deactivatedAt === null : existing.deactivatedAt === null;
    const syncCost =
      isFabricaList(finalDescription) &&
      stillActive &&
      (dto.value !== undefined || dto.description !== undefined || dto.productId !== undefined);
    if (syncCost) await this.assertFabricaEditable(finalProductId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const price = await tx.price.update({ where: { id }, data, include: { product: true } });
      if (syncCost) await this.syncCostFromFabrica(tx, finalProductId, Number(price.value));
      return price;
    });
    if (syncCost) await this.notifyCostingInputsChanged();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.price.update({
      where: { id },
      data: { deactivatedAt: new Date() },
      include: { product: true },
    });
  }

  /**
   * Por cada par (producto + lista/descripción): archiva las filas seleccionadas y crea un precio activo nuevo
   * con el mismo `description` y el valor indicado.
   */
  async bulkReplace(dto: BulkReplacePriceDto) {
    const uniqueIds = [...new Set(dto.priceIds)];
    const preCheck = await this.prisma.price.findMany({ where: { id: { in: uniqueIds } } });
    for (const p of preCheck) {
      await this.assertChannelSellable(p.productId, p.description);
      if (isFabricaList(p.description)) await this.assertFabricaEditable(p.productId);
    }

    let touchedFabrica = false;
    const result = await this.prisma.$transaction(async (tx) => {
      const records = await tx.price.findMany({
        where: { id: { in: uniqueIds } },
      });
      if (records.length !== uniqueIds.length) {
        throw new BadRequestException("Uno o más precios no existen");
      }
      for (const p of records) {
        if (p.deactivatedAt) {
          throw new BadRequestException("Algún precio seleccionado ya está archivado");
        }
      }

      const listKey = (p: Price) => `${p.productId}\u0001${p.description ?? ""}`;
      const byKey = new Map<string, string[]>();
      const keyMeta = new Map<string, { productId: string; description: string | null }>();

      for (const p of records) {
        const k = listKey(p);
        if (!byKey.has(k)) {
          keyMeta.set(k, { productId: p.productId, description: p.description });
          byKey.set(k, []);
        }
        byKey.get(k)!.push(p.id);
      }

      const created = [];
      for (const [k, priceRowIds] of byKey) {
        const { productId, description } = keyMeta.get(k)!;
        for (const id of priceRowIds) {
          await tx.price.update({
            where: { id },
            data: { deactivatedAt: new Date() },
          });
        }
        const row = await tx.price.create({
          data: {
            productId,
            value: dto.value,
            description: description ?? undefined,
          },
          include: { product: { select: { id: true, name: true } } },
        });
        if (isFabricaList(description)) {
          await this.syncCostFromFabrica(tx, productId, dto.value);
          touchedFabrica = true;
        }
        created.push(row);
      }

      return { count: created.length, prices: created };
    });
    if (touchedFabrica) await this.notifyCostingInputsChanged();
    return result;
  }

  /** Archiva el precio y crea uno nuevo con la misma lista (`description`) y producto. */
  async replace(id: string, dto: ReplacePriceDto) {
    const target = await this.prisma.price.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`Precio con id "${id}" no encontrado`);
    }
    await this.assertChannelSellable(target.productId, target.description);
    const fabrica = isFabricaList(target.description);
    if (fabrica) await this.assertFabricaEditable(target.productId);

    const replaced = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.price.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Precio con id "${id}" no encontrado`);
      }
      if (existing.deactivatedAt) {
        throw new BadRequestException("Este precio ya está archivado; creá uno nuevo o editá uno activo.");
      }

      await tx.price.update({
        where: { id },
        data: { deactivatedAt: new Date() },
      });

      const row = await tx.price.create({
        data: {
          productId: existing.productId,
          value: dto.value,
          description: existing.description ?? undefined,
        },
        include: { product: { select: { id: true, name: true } } },
      });
      if (fabrica) await this.syncCostFromFabrica(tx, existing.productId, dto.value);
      return row;
    });
    if (fabrica) await this.notifyCostingInputsChanged();
    return replaced;
  }

  /**
   * El Costo sigue al precio Fábrica (y viceversa, ver CostService.syncFabricaPrice): se archivan los costos
   * activos del producto y se crea uno nuevo con ese valor. Se escribe directo con Prisma (no vía CostService)
   * para no volver a disparar la sincronización inversa.
   */
  private async syncCostFromFabrica(tx: Prisma.TransactionClient, productId: string, value: number): Promise<void> {
    const active = await tx.cost.findMany({ where: { productId, deactivatedAt: null }, select: { id: true, value: true } });
    if (active.length === 1 && Math.abs(Number(active[0].value) - value) < 0.005) return;
    if (active.length > 0) {
      await tx.cost.updateMany({
        where: { id: { in: active.map((c) => c.id) } },
        data: { deactivatedAt: new Date() },
      });
    }
    await tx.cost.create({ data: { productId, value } });
  }

  /** Recalcula las recetas que usan este costo (ver RecipeCostSyncService). */
  private async notifyCostingInputsChanged() {
    await this.eventEmitter.emitAsync(COSTING_INPUTS_CHANGED);
  }

  /**
   * Ingredientes (cantidad y precio de compra) y recetas derivan su costo de otros datos: tocar su precio
   * Fábrica a mano pisaría ese costo y lo desincronizaría. Mismo criterio que CostService.
   */
  private async assertFabricaEditable(productId: string) {
    const [ingredient, recipe] = await Promise.all([
      this.prisma.ingredientProfile.findUnique({ where: { productId } }),
      this.prisma.recipeCostProfile.findUnique({ where: { productId } }),
    ]);
    if (ingredient) {
      throw new BadRequestException(
        "Este producto tiene cantidad y precio de compra cargados en Ingredientes. Editá el costo desde esa pantalla para no desincronizar los datos.",
      );
    }
    if (recipe) {
      throw new BadRequestException(
        "Este producto es una receta: su costo (y su precio Fábrica) se calculan desde Recetas y se actualizan solos.",
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

  /**
   * Si el producto es una receta con perfil de costeo (RecipeCostProfile) y ese canal tiene
   * margen null (Excel: "no se vende" por ese canal), no se puede cargar un precio ahí — evita
   * precios fantasma en canales que el negocio nunca ofrece para esa receta.
   */
  private async assertChannelSellable(productId: string, description?: string | null) {
    const channel = description?.trim().toLowerCase();
    const marginField =
      channel === "minorista" ? "marginRetailPct" : channel === "mayorista" ? "marginWholesalePct" : channel === "catering" ? "marginCateringPct" : null;
    if (!marginField) return;

    const profile = await this.prisma.recipeCostProfile.findUnique({ where: { productId } });
    if (!profile) return;
    if (profile[marginField] == null) {
      throw new BadRequestException(
        `Esta receta no se vende por canal "${channel}" (margen no configurado) — no se puede cargar un precio ahí.`,
      );
    }
  }
}
