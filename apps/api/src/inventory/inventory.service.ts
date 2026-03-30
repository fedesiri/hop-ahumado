import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultLocationId(tx: Prisma.TransactionClient = this.prisma): Promise<string> {
    const loc = await tx.stockLocation.findFirst({ where: { isDefault: true } });
    if (!loc) {
      throw new InternalServerErrorException("No hay ubicación de stock por defecto configurada");
    }
    return loc.id;
  }

  /**
   * Ajusta el saldo en una ubicación y recalcula `Product.stock` como suma de saldos.
   */
  async applyBalanceDelta(
    tx: Prisma.TransactionClient,
    productId: string,
    locationId: string,
    delta: number,
  ): Promise<void> {
    const row = await tx.stockBalance.findUnique({
      where: { productId_locationId: { productId, locationId } },
    });
    const current = row?.quantity ?? 0;
    const next = current + delta;
    await tx.stockBalance.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity: next },
      update: { quantity: next },
    });
    const sum = await tx.stockBalance.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    const total = sum._sum.quantity ?? 0;
    await tx.product.update({ where: { id: productId }, data: { stock: total } });
  }

  /** Recalcula `Product.stock` como suma de `StockBalance` (p.ej. tras borrar una ubicación). */
  async syncProductStockFromBalances(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const sum = await tx.stockBalance.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { stock: sum._sum.quantity ?? 0 },
    });
  }
}
