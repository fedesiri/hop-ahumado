import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Cost } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCostDto } from "./dto/create-cost.dto";
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
  ): Promise<PaginatedResponse<Cost & { product: { id: string; name: string } }>> {
    const where: { productId?: string; deactivatedAt?: Date | null } = {};
    if (productId) where.productId = productId;
    if (activeOnly) where.deactivatedAt = null;
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

  private async validateProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new BadRequestException(`Producto con id "${productId}" no encontrado`);
    }
  }
}
