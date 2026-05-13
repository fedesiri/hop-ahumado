import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Cost, Prisma } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCostDto } from "./dto/create-cost.dto";
import { BulkReplaceCostDto } from "./dto/bulk-replace-cost.dto";
import { ReplaceCostDto } from "./dto/replace-cost.dto";
import { UpdateCostDto } from "./dto/update-cost.dto";

@Injectable()
export class CostService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCostDto) {
    await this.validateProductExists(dto.productId);
    return this.prisma.cost.create({
      data: { productId: dto.productId, value: dto.value },
      include: { product: true },
    });
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    productId?: string,
    activeOnly = false,
    search?: string,
  ): Promise<PaginatedResponse<Cost & { product: { id: string; name: string } }>> {
    const where: Prisma.CostWhereInput = {};
    if (productId) where.productId = productId;
    if (activeOnly) where.deactivatedAt = null;

    const trimmed = search?.trim();
    if (trimmed) {
      where.product = {
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { sku: { contains: trimmed, mode: "insensitive" } },
          { barcode: { contains: trimmed, mode: "insensitive" } },
        ],
      };
    }
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

  async update(id: string, dto: UpdateCostDto) {
    await this.findOne(id);
    if (dto.productId !== undefined) {
      await this.validateProductExists(dto.productId);
    }
    const data: { productId?: string; value?: number; deactivatedAt?: Date | null } = {};
    if (dto.productId !== undefined) data.productId = dto.productId;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.deactivatedAt !== undefined) {
      data.deactivatedAt = dto.deactivatedAt === null ? null : new Date(dto.deactivatedAt);
    }
    return this.prisma.cost.update({
      where: { id },
      data,
      include: { product: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cost.update({
      where: { id },
      data: { deactivatedAt: new Date() },
      include: { product: true },
    });
  }

  /**
   * Para cada producto involucrado: desactiva todos los costos seleccionados de ese producto
   * y crea un único costo nuevo (mismo valor para todos).
   */
  async bulkReplace(dto: BulkReplaceCostDto) {
    const uniqueIds = [...new Set(dto.costIds)];
    return this.prisma.$transaction(async (tx) => {
      const records = await tx.cost.findMany({
        where: { id: { in: uniqueIds } },
      });
      if (records.length !== uniqueIds.length) {
        throw new BadRequestException("Uno o más costos no existen");
      }
      for (const c of records) {
        if (c.deactivatedAt) {
          throw new BadRequestException("Algún costo seleccionado ya está archivado");
        }
      }

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
        created.push(row);
      }

      return { count: created.length, costs: created };
    });
  }

  /**
   * Desactiva el costo indicado y crea uno nuevo para el mismo producto (historial preservado).
   */
  async replace(id: string, dto: ReplaceCostDto) {
    return this.prisma.$transaction(async (tx) => {
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

      return tx.cost.create({
        data: { productId: existing.productId, value: dto.value },
        include: { product: { select: { id: true, name: true } } },
      });
    });
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
