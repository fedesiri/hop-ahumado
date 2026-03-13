import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Order } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

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
};

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    if (dto.customerId) await this.validateCustomerExists(dto.customerId);
    if (dto.userId) await this.validateUserExists(dto.userId);
    for (const item of dto.items) {
      await this.validateProductExists(item.productId);
    }
    const itemsTotal = dto.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    if (Math.abs(itemsTotal - dto.total) > 0.01) {
      throw new BadRequestException(
        `El total (${dto.total}) no coincide con la suma de ítems (${itemsTotal.toFixed(2)})`,
      );
    }
    const paymentsTotal = dto.payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paymentsTotal - dto.total) > 0.01) {
      throw new BadRequestException(
        `La suma de pagos (${paymentsTotal.toFixed(2)}) debe coincidir con el total (${dto.total})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: dto.customerId ?? undefined,
          userId: dto.userId ?? undefined,
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
          total: dto.total,
          orderItems: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
            })),
          },
          payments: {
            create: dto.payments.map((p) => ({
              amount: p.amount,
              method: p.method,
            })),
          },
        },
        include: {
          orderItems: { include: { product: { select: { id: true, name: true } } } },
          payments: true,
          customer: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
      return order;
    });
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
  ): Promise<PaginatedResponse<OrderWithRelations>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          orderItems: { include: { product: { select: { id: true, name: true } } } },
          payments: true,
          customer: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.order.count(),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: { include: { product: true } },
        payments: true,
        customer: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!order) {
      throw new NotFoundException(`Orden con id "${id}" no encontrada`);
    }
    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    await this.findOne(id);
    if (dto.customerId) await this.validateCustomerExists(dto.customerId);
    if (dto.userId) await this.validateUserExists(dto.userId);
    return this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
        ...(dto.deliveryDate !== undefined && {
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
        }),
      },
      include: {
        orderItems: { include: { product: { select: { id: true, name: true } } } },
        payments: true,
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId: id } });
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
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
}
