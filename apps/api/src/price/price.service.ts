import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Price } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePriceDto } from "./dto/create-price.dto";
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
  ): Promise<PaginatedResponse<Price & { product: { id: string; name: string } }>> {
    const where: { productId?: string; deactivatedAt?: Date | null } = {};
    if (productId) {
      where.productId = productId;
    }
    if (activeOnly) {
      where.deactivatedAt = null;
    }
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

  private async validateProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new BadRequestException(`Producto con id "${productId}" no encontrado`);
    }
  }
}
