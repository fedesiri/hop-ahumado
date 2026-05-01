import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { StockMovement, StockMovementType } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";

const locationSelect = { id: true, name: true } as const;

type StockMovementWithProduct = StockMovement & {
  product: { id: string; name: string; stock: number };
  location?: { id: string; name: string } | null;
  fromLocation?: { id: string; name: string } | null;
  toLocation?: { id: string; name: string } | null;
};

@Injectable()
export class StockMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private notifyStockObservers(
    product: { id: string; name: string },
    priorTotalStock: number,
    resultingStock: number,
    dto: CreateStockMovementDto,
  ): void {
    if (dto.type === StockMovementType.TRANSFER) return;

    const lowThreshold = Number(process.env.STOCK_LOW_THRESHOLD_QUANTITY ?? 10);
    const qtyAbs = dto.type === StockMovementType.ADJUSTMENT ? Math.abs(dto.quantity) : dto.quantity;

    if (resultingStock <= 0) {
      this.eventEmitter.emit("stock.out", {
        productId: product.id,
        productName: product.name,
        quantity: resultingStock,
      });
    } else if (resultingStock <= lowThreshold) {
      this.eventEmitter.emit("stock.low", {
        productId: product.id,
        productName: product.name,
        quantity: resultingStock,
      });
    }

    const absMin = Number(process.env.STOCK_ATYPICAL_MIN_ABSOLUTE ?? 100);
    const fracMin = Number(process.env.STOCK_ATYPICAL_MIN_FRACTION_OF_STOCK ?? 0.35);
    const largeAbsolute = qtyAbs >= absMin;
    const largeVsPrior = priorTotalStock > 0 && qtyAbs / priorTotalStock >= fracMin;
    const movable =
      dto.type === StockMovementType.OUT ||
      dto.type === StockMovementType.IN ||
      dto.type === StockMovementType.ADJUSTMENT;
    if (movable && (largeAbsolute || largeVsPrior)) {
      this.eventEmitter.emit("stock.atypical_movement", {
        productId: product.id,
        productName: product.name,
        movementQuantity: qtyAbs,
        movementType: dto.type,
        priorStock: priorTotalStock,
        newStock: resultingStock,
      });
    }
  }

  async create(dto: CreateStockMovementDto) {
    if (dto.type === StockMovementType.TRANSFER) {
      if (dto.quantity <= 0) {
        throw new BadRequestException("Para TRANSFER la cantidad debe ser mayor que 0");
      }
      if (!dto.fromLocationId || !dto.toLocationId) {
        throw new BadRequestException("TRANSFER requiere fromLocationId y toLocationId");
      }
      if (dto.fromLocationId === dto.toLocationId) {
        throw new BadRequestException("El origen y destino del traslado deben ser distintos");
      }
    } else {
      if (dto.type === StockMovementType.IN || dto.type === StockMovementType.OUT) {
        if (dto.quantity <= 0) {
          throw new BadRequestException("Para IN y OUT la cantidad debe ser mayor que 0");
        }
      }
      if (dto.type === StockMovementType.ADJUSTMENT && dto.quantity === 0) {
        throw new BadRequestException("Para ADJUSTMENT la cantidad no puede ser 0");
      }
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, name: true, stock: true },
      });
      if (!product) {
        throw new BadRequestException(`Producto con id "${dto.productId}" no encontrado`);
      }
      const priorTotalStock = product.stock;

      if (dto.type === StockMovementType.TRANSFER) {
        const fromId = dto.fromLocationId!;
        const toId = dto.toLocationId!;
        await this.inventory.applyBalanceDelta(tx, dto.productId, fromId, -dto.quantity);
        await this.inventory.applyBalanceDelta(tx, dto.productId, toId, dto.quantity);
        const movement = await tx.stockMovement.create({
          data: {
            productId: dto.productId,
            quantity: dto.quantity,
            type: StockMovementType.TRANSFER,
            reason: dto.reason ?? undefined,
            fromLocationId: fromId,
            toLocationId: toId,
          },
          include: {
            product: { select: { id: true, name: true, stock: true } },
            fromLocation: { select: locationSelect },
            toLocation: { select: locationSelect },
          },
        });
        const p = await tx.product.findUnique({
          where: { id: dto.productId },
          select: { stock: true },
        });
        return {
          movement: {
            ...movement,
            product: { ...movement.product, stock: p!.stock },
          },
          priorTotalStock,
          productMeta: { id: product.id, name: product.name },
        };
      }

      const defaultId = await this.inventory.getDefaultLocationId(tx);
      const locationId = dto.locationId ?? defaultId;

      const delta =
        dto.type === StockMovementType.IN
          ? dto.quantity
          : dto.type === StockMovementType.OUT
            ? -dto.quantity
            : dto.quantity;
      const newTotal = product.stock + delta;
      if (newTotal < 0) {
        throw new BadRequestException(
          `Stock insuficiente. Actual: ${product.stock}, movimiento: ${delta}. Resultado sería ${newTotal}`,
        );
      }

      await this.inventory.applyBalanceDelta(tx, dto.productId, locationId, delta);

      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          quantity: dto.quantity,
          type: dto.type,
          reason: dto.reason ?? undefined,
          locationId,
        },
        include: {
          product: { select: { id: true, name: true, stock: true } },
          location: { select: locationSelect },
        },
      });

      const p = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { stock: true },
      });
      return {
        movement: {
          ...movement,
          product: { ...movement.product, stock: p!.stock },
        },
        priorTotalStock,
        productMeta: { id: product.id, name: product.name },
      };
    });

    const m = movement.movement as StockMovementWithProduct & { product: { stock: number } };
    this.notifyStockObservers(movement.productMeta, movement.priorTotalStock, m.product.stock, dto);
    return m;
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    productId?: string,
  ): Promise<PaginatedResponse<StockMovementWithProduct>> {
    const where = productId ? { productId } : undefined;
    const skip = (page - 1) * limit;
    const include = {
      product: { select: { id: true, name: true, stock: true } },
      location: { select: locationSelect },
      fromLocation: { select: locationSelect },
      toLocation: { select: locationSelect },
    };
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include,
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
      include: {
        product: true,
        location: { select: locationSelect },
        fromLocation: { select: locationSelect },
        toLocation: { select: locationSelect },
      },
    });
    if (!movement) {
      throw new NotFoundException(`Movimiento de stock con id "${id}" no encontrado`);
    }
    return movement;
  }
}
