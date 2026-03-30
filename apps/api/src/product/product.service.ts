import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Product } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

type ProductWithCategory = Product & { category: { id: string; name: string } | null };

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(dto: CreateProductDto) {
    if (dto.categoryId) {
      await this.validateCategoryExists(dto.categoryId);
    }
    const data = this.mapCreateDtoToPrisma(dto);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data });
      const defaultLocId = await this.inventory.getDefaultLocationId(tx);
      const qty = dto.stock ?? 0;
      await tx.stockBalance.upsert({
        where: { productId_locationId: { productId: product.id, locationId: defaultLocId } },
        create: { productId: product.id, locationId: defaultLocId, quantity: qty },
        update: { quantity: qty },
      });
      return tx.product.findUnique({
        where: { id: product.id },
        include: { category: true },
      }) as Promise<ProductWithCategory>;
    });
  }

  async findAll(
    includeDeactivated = false,
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    search?: string,
    categoryId?: string,
  ): Promise<PaginatedResponse<ProductWithCategory>> {
    const where: any = {};

    // Cuando includeDeactivated es true mostramos SOLO desactivados,
    // cuando es false mostramos SOLO activos (deactivationDate = null).
    if (includeDeactivated) {
      where.deactivationDate = { not: null };
    } else {
      where.deactivationDate = null;
    }

    if (search) {
      const trimmed = search.trim();
      if (trimmed) {
        where.AND = [
          ...(where.AND ?? []),
          {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { sku: { contains: trimmed, mode: "insensitive" } },
              { barcode: { contains: trimmed, mode: "insensitive" } },
            ],
          },
        ];
      }
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        include: { category: true },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.findOne(id);
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        await this.validateCategoryExists(dto.categoryId);
      }
    }
    if (dto.stock !== undefined) {
      const newStock = (() => {
        const n = Number(dto.stock);
        if (!Number.isFinite(n) || n < 0) {
          throw new BadRequestException("stock debe ser un número mayor o igual a 0");
        }
        return n;
      })();
      const delta = newStock - existing.stock;
      if (delta === 0) {
        const data = this.mapUpdateDtoToPrisma({ ...dto, stock: undefined });
        return this.prisma.product.update({
          where: { id },
          data,
          include: { category: true },
        });
      }
      return this.prisma.$transaction(async (tx) => {
        const data = this.mapUpdateDtoToPrisma({ ...dto, stock: undefined });
        await tx.product.update({ where: { id }, data });
        const defaultLocId = await this.inventory.getDefaultLocationId(tx);
        await this.inventory.applyBalanceDelta(tx, id, defaultLocId, delta);
        return tx.product.findUnique({
          where: { id },
          include: { category: true },
        }) as Promise<ProductWithCategory>;
      });
    }
    const data = this.mapUpdateDtoToPrisma(dto);
    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  /** Soft-delete: marca el producto como desactivado (deactivationDate = ahora). */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { deactivationDate: new Date() },
    });
  }

  private async validateCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException(`Categoría con id "${categoryId}" no encontrada`);
    }
  }

  private mapCreateDtoToPrisma(dto: CreateProductDto) {
    return {
      name: dto.name,
      description: dto.description ?? undefined,
      categoryId: dto.categoryId ?? undefined,
      sku: dto.sku ?? undefined,
      barcode: dto.barcode ?? undefined,
      stock: dto.stock ?? 0,
      unit: dto.unit ?? "UNIT",
      deactivationDate: dto.deactivationDate ? new Date(dto.deactivationDate) : undefined,
    };
  }

  private mapUpdateDtoToPrisma(dto: UpdateProductDto) {
    const deactivationDate =
      dto.deactivationDate === null
        ? null
        : dto.deactivationDate !== undefined
          ? new Date(dto.deactivationDate)
          : undefined;
    if (deactivationDate !== undefined && deactivationDate !== null && Number.isNaN(deactivationDate.getTime())) {
      throw new BadRequestException("deactivationDate no es una fecha válida");
    }
    const categoryId =
      dto.categoryId === undefined
        ? undefined
        : dto.categoryId === null || dto.categoryId === ""
          ? null
          : dto.categoryId;
    const stock =
      dto.stock === undefined
        ? undefined
        : (() => {
            const n = Number(dto.stock);
            if (!Number.isFinite(n) || n < 0) {
              throw new BadRequestException("stock debe ser un número mayor o igual a 0");
            }
            return n;
          })();
    return {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.categoryId !== undefined && { categoryId }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.barcode !== undefined && { barcode: dto.barcode }),
      ...(dto.stock !== undefined && { stock }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      ...(dto.deactivationDate !== undefined && {
        deactivationDate,
      }),
    };
  }
}
