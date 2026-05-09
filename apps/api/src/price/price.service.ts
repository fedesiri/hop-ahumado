import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Price, Prisma } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { BulkReplacePriceDto } from "./dto/bulk-replace-price.dto";
import { CreatePriceDto } from "./dto/create-price.dto";
import { ReplacePriceDto } from "./dto/replace-price.dto";
import { UpdatePriceDto } from "./dto/update-price.dto";

@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePriceDto) {
    await this.validateProductExists(dto.productId);
    return this.prisma.price.create({
      data: {
        productId: dto.productId,
        value: dto.value,
        description: dto.description ?? undefined,
      },
      include: { product: true },
    });
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    productId?: string,
    activeOnly = false,
    search?: string,
    listType?: string,
  ): Promise<PaginatedResponse<Price & { product: { id: string; name: string } }>> {
    const andParts: Prisma.PriceWhereInput[] = [];
    if (productId) {
      andParts.push({ productId });
    }
    if (activeOnly) {
      andParts.push({ deactivatedAt: null });
    }
    const trimmed = search?.trim();
    if (trimmed) {
      andParts.push({
        product: {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { sku: { contains: trimmed, mode: "insensitive" } },
            { barcode: { contains: trimmed, mode: "insensitive" } },
          ],
        },
      });
    }

    const lt = listType?.trim().toLowerCase();
    if (lt === "mayorista" || lt === "minorista") {
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
    await this.findOne(id);
    if (dto.productId !== undefined) {
      await this.validateProductExists(dto.productId);
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
    return this.prisma.price.update({
      where: { id },
      data,
      include: { product: true },
    });
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
    return this.prisma.$transaction(async (tx) => {
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
        created.push(row);
      }

      return { count: created.length, prices: created };
    });
  }

  /** Archiva el precio y crea uno nuevo con la misma lista (`description`) y producto. */
  async replace(id: string, dto: ReplacePriceDto) {
    return this.prisma.$transaction(async (tx) => {
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

      return tx.price.create({
        data: {
          productId: existing.productId,
          value: dto.value,
          description: existing.description ?? undefined,
        },
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
