import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Order, Prisma, StockMovementType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { CustomerProfileService } from "../customer-profile/customer-profile.service";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import {
  computeOrderFields,
  enrichOrdersWithComputedFields,
  enrichOrderWithComputedFields,
  ORDER_PAYMENT_TOLERANCE,
} from "./order-computed-properties";
import { OrderPaymentStatus } from "./order-payment-status.enum";
import { getPromoThresholdCategoryNames, validateOrderPromoPricing } from "./order-promo";

type OrderWithRelations = Order & {
  orderItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: Decimal;
    product: { id: string; name: string };
  }>;
  payments: Array<{
    id: string;
    amount: Decimal;
    method: string;
    createdAt: Date;
  }>;
  customer: { id: string; name: string } | null;
  user: { id: string; name: string; email: string } | null;
  fulfillmentLocation: { id: string; name: string } | null;
};

type OrderWithComputedFields = OrderWithRelations & {
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: OrderPaymentStatus;
  isDelivered: boolean;
};

const ORDER_INCLUDE = {
  orderItems: { include: { product: { select: { id: true, name: true, stock: true } } } },
  payments: true,
  customer: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, email: true } },
  fulfillmentLocation: { select: { id: true, name: true } },
} as const;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly customerProfileService: CustomerProfileService,
  ) {}

  async create(dto: CreateOrderDto) {
    if (dto.customerId) await this.validateCustomerExists(dto.customerId);
    if (dto.userId) await this.validateUserExists(dto.userId);
    for (const item of dto.items) {
      await this.validateProductExists(item.productId);
    }
    await this.validateOrderItemsTotalOrPromo(dto);

    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const fulfillmentLocationId = dto.fulfillmentLocationId ?? (await this.inventory.getDefaultLocationId(tx));

      const order = await tx.order.create({
        data: {
          customerId: dto.customerId ?? undefined,
          userId: dto.userId ?? undefined,
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
          total: dto.total,
          ...(dto.comment !== undefined && {
            comment: dto.comment.trim() ? dto.comment.trim() : null,
          }),
          ...(dto.priceListType !== undefined && {
            priceListType: dto.priceListType || null,
          }),
          fulfillmentLocationId,
          orderItems: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      // Descontar stock: si el producto tiene receta (combo), se descuentan los ingredientes; si no, el producto mismo.
      for (const item of order.orderItems) {
        const targets = await this.stockTargetsForOrderLine(tx, item.productId, item.quantity);
        for (const t of targets) {
          await this.inventory.applyBalanceDelta(tx, t.productId, fulfillmentLocationId, -t.quantity);
          await tx.stockMovement.create({
            data: {
              productId: t.productId,
              quantity: t.quantity,
              type: StockMovementType.OUT,
              reason: `Orden ${order.id.slice(0, 8)}`,
              locationId: fulfillmentLocationId,
            },
          });
        }
      }

      const reloadedOrder = (await tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_INCLUDE,
      })) as OrderWithRelations;

      return reloadedOrder;
    });
    if (dto.customerId) {
      await this.customerProfileService.ensureProfileForCustomer(dto.customerId);
    }
    return this.enrichOrder(createdOrder);
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    customerId?: string,
    userId?: string,
    dateFrom?: string,
    dateTo?: string,
    minTotal?: number,
    maxTotal?: number,
    paymentStatus?: OrderPaymentStatus,
    delivered?: "true" | "false",
  ): Promise<PaginatedResponse<OrderWithComputedFields>> {
    const skip = (page - 1) * limit;
    const tol = ORDER_PAYMENT_TOLERANCE;

    if (paymentStatus !== undefined) {
      const whereClause = this.sqlOrderListWhereClauses(
        { customerId, userId, dateFrom, dateTo, minTotal, maxTotal, delivered },
        this.sqlOrderPaymentStatusCondition(paymentStatus, tol),
      );
      return this.findAllWithPaymentStatusSql(page, limit, skip, whereClause);
    }

    const where: Prisma.OrderWhereInput = this.buildPrismaOrderListWhere({
      customerId,
      userId,
      dateFrom,
      dateTo,
      minTotal,
      maxTotal,
      delivered,
    });

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE,
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return buildPaginatedResponse(this.enrichOrders(data as OrderWithRelations[]), total, page, limit);
  }

  private buildPrismaOrderListWhere(params: {
    customerId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    minTotal?: number;
    maxTotal?: number;
    delivered?: "true" | "false";
  }): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    if (params.customerId) {
      where.customerId = params.customerId;
    }
    if (params.userId) {
      where.userId = params.userId;
    }
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) {
        where.createdAt.gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        const end = new Date(params.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (params.minTotal !== undefined || params.maxTotal !== undefined) {
      where.total = {};
      if (params.minTotal !== undefined) {
        where.total.gte = params.minTotal;
      }
      if (params.maxTotal !== undefined) {
        where.total.lte = params.maxTotal;
      }
    }
    if (params.delivered === "true") {
      where.deliveredAt = { not: null };
    } else if (params.delivered === "false") {
      where.deliveredAt = null;
    }
    return where;
  }

  /** Condición SQL alineada con `computeOrderFields` (líneas vs pagos, tolerancia monetaria). */
  private sqlOrderPaymentStatusCondition(status: OrderPaymentStatus, tol: number): Prisma.Sql {
    if (status === OrderPaymentStatus.UNPAID) {
      return Prisma.sql`(
        (SELECT COALESCE(SUM("amount"::float8), 0) FROM "Payment" WHERE "orderId" = o."id") < ${tol}
      )`;
    }
    if (status === OrderPaymentStatus.PAID) {
      return Prisma.sql`(
        ABS(
          (SELECT COALESCE(SUM("amount"::float8), 0) FROM "Payment" WHERE "orderId" = o."id") -
          (SELECT COALESCE(SUM(oi."quantity" * oi."price"::float8), 0) FROM "OrderItem" oi WHERE oi."orderId" = o."id")
        ) < ${tol}
        OR
        (SELECT COALESCE(SUM("amount"::float8), 0) FROM "Payment" WHERE "orderId" = o."id") >
        (SELECT COALESCE(SUM(oi."quantity" * oi."price"::float8), 0) FROM "OrderItem" oi WHERE oi."orderId" = o."id")
      )`;
    }
    return Prisma.sql`(
      (SELECT COALESCE(SUM("amount"::float8), 0) FROM "Payment" WHERE "orderId" = o."id") >= ${tol}
      AND NOT (
        (
          ABS(
            (SELECT COALESCE(SUM("amount"::float8), 0) FROM "Payment" WHERE "orderId" = o."id") -
            (SELECT COALESCE(SUM(oi."quantity" * oi."price"::float8), 0) FROM "OrderItem" oi WHERE oi."orderId" = o."id")
          ) < ${tol}
        )
        OR
        (
          (SELECT COALESCE(SUM("amount"::float8), 0) FROM "Payment" WHERE "orderId" = o."id") >
          (SELECT COALESCE(SUM(oi."quantity" * oi."price"::float8), 0) FROM "OrderItem" oi WHERE oi."orderId" = o."id")
        )
      )
    )`;
  }

  private sqlOrderListWhereClauses(
    params: {
      customerId?: string;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
      minTotal?: number;
      maxTotal?: number;
      delivered?: "true" | "false";
    },
    paymentCondition: Prisma.Sql,
  ): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (params.customerId) {
      parts.push(Prisma.sql`o."customerId" = ${params.customerId}`);
    }
    if (params.userId) {
      parts.push(Prisma.sql`o."userId" = ${params.userId}`);
    }
    if (params.dateFrom) {
      parts.push(Prisma.sql`o."createdAt" >= ${new Date(params.dateFrom)}`);
    }
    if (params.dateTo) {
      const end = new Date(params.dateTo);
      end.setHours(23, 59, 59, 999);
      parts.push(Prisma.sql`o."createdAt" <= ${end}`);
    }
    if (params.minTotal !== undefined) {
      parts.push(Prisma.sql`o."total"::float8 >= ${params.minTotal}`);
    }
    if (params.maxTotal !== undefined) {
      parts.push(Prisma.sql`o."total"::float8 <= ${params.maxTotal}`);
    }
    if (params.delivered === "true") {
      parts.push(Prisma.sql`o."deliveredAt" IS NOT NULL`);
    } else if (params.delivered === "false") {
      parts.push(Prisma.sql`o."deliveredAt" IS NULL`);
    }
    if (parts.length === 0) {
      return paymentCondition;
    }
    return Prisma.join([...parts, paymentCondition], " AND ");
  }

  private async findAllWithPaymentStatusSql(
    page: number,
    limit: number,
    skip: number,
    whereClause: Prisma.Sql,
  ): Promise<PaginatedResponse<OrderWithComputedFields>> {
    const [countResult] = await this.prisma.$queryRaw<[{ c: number }]>(
      Prisma.sql`SELECT COUNT(*)::int AS c FROM "Order" o WHERE ${whereClause}`,
    );
    const total = countResult?.c ?? 0;
    if (total === 0) {
      return buildPaginatedResponse([], 0, page, limit);
    }

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT o."id" FROM "Order" o WHERE ${whereClause} ORDER BY o."createdAt" DESC LIMIT ${limit} OFFSET ${skip}`,
    );
    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) {
      return buildPaginatedResponse([], total, page, limit);
    }

    const rows = (await this.prisma.order.findMany({
      where: { id: { in: ids } },
      include: ORDER_INCLUDE,
    })) as OrderWithRelations[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter((o): o is OrderWithRelations => o != null);
    return buildPaginatedResponse(this.enrichOrders(ordered), total, page, limit);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Orden con id "${id}" no encontrada`);
    }
    return this.enrichOrder(order as OrderWithRelations);
  }

  async update(id: string, dto: UpdateOrderDto) {
    const hasItems = dto.items !== undefined;
    const hasTotal = dto.total !== undefined;

    if (hasItems !== hasTotal) {
      throw new BadRequestException("Para editar ítems y stock deben enviarse juntos: items y total");
    }

    if (hasItems && dto.items && dto.total !== undefined) {
      return this.updateWithItemsAndStock(id, dto);
    }

    await this.findOne(id);
    if (dto.customerId) await this.validateCustomerExists(dto.customerId);
    if (dto.userId) await this.validateUserExists(dto.userId);
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
        ...(dto.deliveryDate !== undefined && {
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
        }),
        ...(dto.deliveredAt !== undefined && {
          deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : null,
        }),
        ...(dto.comment !== undefined && {
          comment: dto.comment.trim() ? dto.comment.trim() : null,
        }),
        ...(dto.priceListType !== undefined && {
          priceListType: dto.priceListType || null,
        }),
      },
      include: ORDER_INCLUDE,
    });
    const cid = updatedOrder.customerId;
    if (cid) {
      await this.customerProfileService.ensureProfileForCustomer(cid);
    }
    return this.enrichOrder(updatedOrder as OrderWithRelations);
  }

  /**
   * Reemplaza ítems: revierte stock de los ítems anteriores (IN) y descuenta el nuevo pedido (OUT).
   */
  private async updateWithItemsAndStock(id: string, dto: UpdateOrderDto) {
    const items = dto.items!;
    const total = dto.total!;

    if (dto.customerId) await this.validateCustomerExists(dto.customerId);
    if (dto.userId) await this.validateUserExists(dto.userId);
    for (const item of items) {
      await this.validateProductExists(item.productId);
    }

    await this.validateOrderItemsTotalOrPromo({ items, total, priceListType: dto.priceListType });

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: {
          orderItems: { include: { product: { select: { id: true, stock: true } } } },
        },
      });
      if (!existing) {
        throw new NotFoundException(`Orden con id "${id}" no encontrada`);
      }

      const revertLocation = existing.fulfillmentLocationId ?? (await this.inventory.getDefaultLocationId(tx));

      for (const line of existing.orderItems) {
        const targets = await this.stockTargetsForOrderLine(tx, line.productId, line.quantity);
        for (const t of targets) {
          await this.inventory.applyBalanceDelta(tx, t.productId, revertLocation, t.quantity);
          await tx.stockMovement.create({
            data: {
              productId: t.productId,
              quantity: t.quantity,
              type: StockMovementType.IN,
              reason: `Reversión edición orden ${id.slice(0, 8)}`,
              locationId: revertLocation,
            },
          });
        }
      }

      const newFulfillmentLocationId =
        dto.fulfillmentLocationId ?? existing.fulfillmentLocationId ?? (await this.inventory.getDefaultLocationId(tx));

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new BadRequestException(`Producto con id "${item.productId}" no encontrado`);
        }
        const targets = await this.stockTargetsForOrderLine(tx, item.productId, item.quantity);
        for (const t of targets) {
          await this.inventory.applyBalanceDelta(tx, t.productId, newFulfillmentLocationId, -t.quantity);
          await tx.stockMovement.create({
            data: {
              productId: t.productId,
              quantity: t.quantity,
              type: StockMovementType.OUT,
              reason: `Orden ${id.slice(0, 8)}`,
              locationId: newFulfillmentLocationId,
            },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          total,
          fulfillmentLocationId: newFulfillmentLocationId,
          ...(dto.customerId !== undefined && { customerId: dto.customerId }),
          ...(dto.userId !== undefined && { userId: dto.userId }),
          ...(dto.deliveryDate !== undefined && {
            deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
          }),
          ...(dto.deliveredAt !== undefined && {
            deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : null,
          }),
          ...(dto.comment !== undefined && {
            comment: dto.comment.trim() ? dto.comment.trim() : null,
          }),
          ...(dto.priceListType !== undefined && {
            priceListType: dto.priceListType || null,
          }),
          orderItems: {
            deleteMany: {},
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
            })),
          },
        },
        include: ORDER_INCLUDE,
      }) as Promise<OrderWithRelations>;
    });
    const cid = updatedOrder.customerId;
    if (cid) {
      await this.customerProfileService.ensureProfileForCustomer(cid);
    }
    return this.enrichOrder(updatedOrder);
  }

  async createPayment(orderId: string, dto: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException(`Orden con id "${orderId}" no encontrada`);
    }

    const computed = computeOrderFields(order as OrderWithRelations);
    if (computed.paidAmount + dto.amount > computed.totalPrice + ORDER_PAYMENT_TOLERANCE) {
      throw new BadRequestException(
        `El pago excede el saldo pendiente. Pendiente: ${computed.remainingAmount.toFixed(2)} | Intento: ${dto.amount.toFixed(2)}`,
      );
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId,
          amount: dto.amount,
          method: dto.method,
        },
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      }) as Promise<OrderWithRelations>;
    });

    if (!updatedOrder) {
      throw new NotFoundException(`Orden con id "${orderId}" no encontrada`);
    }

    return this.enrichOrder(updatedOrder);
  }

  async updatePayment(orderId: string, paymentId: string, dto: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, orderId },
    });

    if (!payment) {
      throw new NotFoundException(`Pago con id "${paymentId}" no encontrado en la orden "${orderId}"`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { method: dto.method },
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      }) as Promise<OrderWithRelations>;
    });

    if (!updatedOrder) {
      throw new NotFoundException(`Orden con id "${orderId}" no encontrada`);
    }

    return this.enrichOrder(updatedOrder);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId: id } });
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }

  private enrichOrder(order: OrderWithRelations): OrderWithComputedFields {
    return enrichOrderWithComputedFields(order);
  }

  private enrichOrders(orders: OrderWithRelations[]): OrderWithComputedFields[] {
    return enrichOrdersWithComputedFields(orders);
  }

  private async validateCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new BadRequestException(`Cliente con id "${customerId}" no encontrado`);
    }
  }

  private async validateUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`Usuario con id "${userId}" no encontrado`);
    }
  }

  private async validateProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new BadRequestException(`Producto con id "${productId}" no encontrado`);
    }
  }

  /**
   * Con `priceListType` valida lista y promo por umbral (combos); sin él mantiene la suma simple líneas = total.
   */
  private async validateOrderItemsTotalOrPromo(dto: {
    items: { productId: string; quantity: number; price: number }[];
    total: number;
    priceListType?: "mayorista" | "minorista" | "fabrica";
  }) {
    if (dto.priceListType) {
      const ids = [...new Set(dto.items.map((i) => i.productId))];
      const products = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        include: { category: true },
      });
      if (products.length !== ids.length) {
        throw new BadRequestException("Hay productos en el pedido que no existen en la base");
      }
      const productsById = new Map(products.map((p) => [p.id, { name: p.name, category: p.category }]));
      const prices = await this.prisma.price.findMany({
        where: { productId: { in: ids }, deactivatedAt: null },
      });
      const pricesByProductId = new Map<string, typeof prices>();
      for (const pr of prices) {
        const arr = pricesByProductId.get(pr.productId) ?? [];
        arr.push(pr);
        pricesByProductId.set(pr.productId, arr);
      }
      validateOrderPromoPricing({
        priceListType: dto.priceListType,
        items: dto.items,
        total: dto.total,
        productsById,
        pricesByProductId,
        categoryNames: getPromoThresholdCategoryNames(),
      });
      return;
    }
    const itemsTotal = dto.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    if (Math.abs(itemsTotal - dto.total) > 0.01) {
      throw new BadRequestException(
        `El total (${dto.total}) no coincide con la suma de ítems (${itemsTotal.toFixed(2)})`,
      );
    }
  }

  /**
   * Si `productId` tiene filas en `RecipeItem`, el pedido descuenta esos ingredientes (cantidad línea × cantidad receta).
   * Si no hay receta, se descuenta el propio producto (comportamiento clásico).
   */
  private async stockTargetsForOrderLine(
    tx: Prisma.TransactionClient,
    productId: string,
    lineQuantity: number,
  ): Promise<{ productId: string; quantity: number }[]> {
    const recipe = await tx.recipeItem.findMany({ where: { productId } });
    if (recipe.length === 0) {
      return [{ productId, quantity: lineQuantity }];
    }
    return recipe.map((r) => ({
      productId: r.ingredientId,
      quantity: lineQuantity * r.quantity,
    }));
  }
}
