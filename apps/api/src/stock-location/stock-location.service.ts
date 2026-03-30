import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStockLocationDto } from "./dto/create-stock-location.dto";
import { TransferAllStockDto } from "./dto/transfer-all-stock.dto";
import { UpdateStockLocationDto } from "./dto/update-stock-location.dto";

@Injectable()
export class StockLocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  findAll() {
    return this.prisma.stockLocation.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async create(dto: CreateStockLocationDto) {
    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.stockLocation.count();
      let isDefault = dto.isDefault === true;
      if (existingCount === 0) {
        isDefault = true;
      }
      if (isDefault) {
        await tx.stockLocation.updateMany({ data: { isDefault: false } });
      }
      return tx.stockLocation.create({
        data: { name: dto.name.trim(), isDefault },
      });
    });
  }

  async update(id: string, dto: UpdateStockLocationDto) {
    if (dto.name === undefined && dto.isDefault === undefined) {
      throw new BadRequestException("Enviá al menos name o isDefault para actualizar");
    }
    return this.prisma.$transaction(async (tx) => {
      const loc = await tx.stockLocation.findUnique({ where: { id } });
      if (!loc) {
        throw new NotFoundException(`Ubicación con id "${id}" no encontrada`);
      }
      if (dto.isDefault === true) {
        await tx.stockLocation.updateMany({ data: { isDefault: false } });
      }
      const wasDefault = loc.isDefault;
      await tx.stockLocation.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });
      if (dto.isDefault === false && wasDefault) {
        await this.ensureOneDefaultLocation(tx);
      }
      return tx.stockLocation.findUniqueOrThrow({ where: { id } });
    });
  }

  /**
   * Elimina la ubicación si no queda stock distinto de cero ahí.
   * Referencias históricas en movimientos y pedidos se ponen en NULL; se recalcula stock de productos afectados.
   */
  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const loc = await tx.stockLocation.findUnique({ where: { id } });
      if (!loc) {
        throw new NotFoundException(`Ubicación con id "${id}" no encontrada`);
      }

      const totalLocations = await tx.stockLocation.count();
      if (totalLocations <= 1) {
        throw new BadRequestException("No se puede eliminar la única ubicación del sistema");
      }

      const balancesAtLoc = await tx.stockBalance.findMany({
        where: { locationId: id },
        select: { quantity: true },
      });
      if (balancesAtLoc.some((b) => Math.abs(Number(b.quantity)) > 1e-6)) {
        throw new BadRequestException(
          "Hay stock distinto de cero en esta ubicación. Trasladalo o ajustalo antes de eliminar.",
        );
      }

      await tx.stockMovement.updateMany({ where: { locationId: id }, data: { locationId: null } });
      await tx.stockMovement.updateMany({ where: { fromLocationId: id }, data: { fromLocationId: null } });
      await tx.stockMovement.updateMany({ where: { toLocationId: id }, data: { toLocationId: null } });
      await tx.order.updateMany({ where: { fulfillmentLocationId: id }, data: { fulfillmentLocationId: null } });

      const balances = await tx.stockBalance.findMany({
        where: { locationId: id },
        select: { productId: true },
      });
      const productIds = [...new Set(balances.map((b) => b.productId))];

      await tx.stockBalance.deleteMany({ where: { locationId: id } });

      for (const productId of productIds) {
        await this.inventory.syncProductStockFromBalances(tx, productId);
      }

      const wasDefault = loc.isDefault;
      await tx.stockLocation.delete({ where: { id } });

      if (wasDefault) {
        await this.ensureOneDefaultLocation(tx);
      }

      return { deleted: true, id };
    });
  }

  private async ensureOneDefaultLocation(tx: Prisma.TransactionClient) {
    const anyDefault = await tx.stockLocation.findFirst({ where: { isDefault: true } });
    if (anyDefault) return;
    const first = await tx.stockLocation.findFirst({ orderBy: { name: "asc" } });
    if (first) {
      await tx.stockLocation.update({ where: { id: first.id }, data: { isDefault: true } });
    }
  }

  async balancesAtLocation(locationId: string) {
    const loc = await this.prisma.stockLocation.findUnique({ where: { id: locationId } });
    if (!loc) {
      throw new NotFoundException(`Ubicación con id "${locationId}" no encontrada`);
    }
    return this.prisma.stockBalance.findMany({
      where: { locationId },
      include: { product: { select: { id: true, name: true, unit: true } } },
      orderBy: { product: { name: "asc" } },
    });
  }

  /**
   * Mueve todo el saldo (por producto) de origen a destino. Deja origen en cero para esas filas.
   * Registra un movimiento TRANSFER por cada producto afectado.
   */
  async transferAllStock(fromLocationId: string, dto: TransferAllStockDto) {
    const { toLocationId } = dto;
    if (fromLocationId === toLocationId) {
      throw new BadRequestException("El origen y el destino deben ser distintos");
    }

    const [fromLoc, toLoc] = await Promise.all([
      this.prisma.stockLocation.findUnique({ where: { id: fromLocationId } }),
      this.prisma.stockLocation.findUnique({ where: { id: toLocationId } }),
    ]);
    if (!fromLoc) {
      throw new NotFoundException(`Ubicación origen con id "${fromLocationId}" no encontrada`);
    }
    if (!toLoc) {
      throw new NotFoundException(`Ubicación destino con id "${toLocationId}" no encontrada`);
    }

    const rows = await this.prisma.stockBalance.findMany({
      where: { locationId: fromLocationId },
    });
    const toMove = rows.filter((r) => Math.abs(Number(r.quantity)) > 1e-6);
    if (toMove.length === 0) {
      return {
        fromLocationId,
        toLocationId,
        movementsCreated: 0,
        message: "No había cantidades distintas de cero en el origen",
      };
    }

    const reason = `Traspaso masivo: ${fromLoc.name} → ${toLoc.name}`;

    return this.prisma.$transaction(async (tx) => {
      let movementsCreated = 0;
      for (const row of toMove) {
        const qty = Number(row.quantity);
        await this.inventory.applyBalanceDelta(tx, row.productId, fromLocationId, -qty);
        await this.inventory.applyBalanceDelta(tx, row.productId, toLocationId, qty);
        await tx.stockMovement.create({
          data: {
            productId: row.productId,
            quantity: Math.abs(qty),
            type: StockMovementType.TRANSFER,
            reason,
            fromLocationId,
            toLocationId,
          },
        });
        movementsCreated += 1;
      }
      return {
        fromLocationId,
        toLocationId,
        movementsCreated,
      };
    });
  }
}
