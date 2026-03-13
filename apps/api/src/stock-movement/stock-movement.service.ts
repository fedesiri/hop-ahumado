import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { StockMovement } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";

type StockMovementWithProduct = StockMovement & {
  product: { id: string; name: string; stock: number };
};

@Injectable()
export class StockMovementService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStockMovementDto) {
    if (dto.type === "IN" || dto.type === "OUT") {
      if (dto.quantity < 1) {
        throw new BadRequestException("Para IN y OUT la cantidad debe ser al menos 1");
      }
    }
    if (dto.type === "ADJUSTMENT" && dto.quantity === 0) {
      throw new BadRequestException("Para ADJUSTMENT la cantidad no puede ser 0");
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, name: true, stock: true },
      });
      if (!product) {
        throw new BadRequestException(`Producto con id "${dto.productId}" no encontrado`);
      }

      const delta = dto.type === "IN" ? dto.quantity : dto.type === "OUT" ? -dto.quantity : dto.quantity;
      const newStock = product.stock + delta;
      if (newStock < 0) {
        throw new BadRequestException(
          `Stock insuficiente. Actual: ${product.stock}, movimiento: ${delta}. Resultado sería ${newStock}`,
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          quantity: dto.quantity,
          type: dto.type,
          reason: dto.reason ?? undefined,
        },
        include: { product: { select: { id: true, name: true, stock: true } } },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: newStock },
      });

      return {
        ...movement,
        product: { ...movement.product, stock: newStock },
      };
    });
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    productId?: string,
  ): Promise<PaginatedResponse<StockMovementWithProduct>> {
    const where = productId ? { productId } : undefined;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { id: true, name: true, stock: true } } },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!movement) {
      throw new NotFoundException(`Movimiento de stock con id "${id}" no encontrado`);
    }
    return movement;
  }
}
