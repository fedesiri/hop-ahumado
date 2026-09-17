import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { RecipeCostProfileService } from "../recipe-cost-profile/recipe-cost-profile.service";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { QuoteItemDto } from "./dto/quote-item.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeCostProfileService: RecipeCostProfileService,
  ) {}

  private async resolveUnitPrice(productId: string, channel: string): Promise<number> {
    const profile = await this.prisma.recipeCostProfile.findUnique({ where: { productId } });
    if (profile) {
      const pricing = await this.recipeCostProfileService.computePricing(productId);
      const ch = pricing.channels.find((c) => c.channel === channel);
      return ch?.finalPrice ?? 0;
    }
    const priceRow = await this.prisma.price.findFirst({
      where: { productId, deactivatedAt: null, description: { equals: channel, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    });
    return priceRow ? Number(priceRow.value) : 0;
  }

  private async resolveItems(items: QuoteItemDto[]) {
    return Promise.all(
      items.map(async (item) => {
        const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new BadRequestException(`Producto con id "${item.productId}" no encontrado`);
        const unitPrice = item.unitPrice ?? (await this.resolveUnitPrice(item.productId, item.channel));
        return { productId: item.productId, channel: item.channel, quantity: item.quantity, unitPrice };
      }),
    );
  }

  private computeTotals(quote: {
    discountPct: number;
    extraTransport: number;
    extraPackaging: number;
    extraStaff: number;
    extraOvertime: number;
    extraOther: number;
    peopleCount: number | null;
  }, items: { quantity: number; unitPrice: number }[]) {
    const subtotalProductos = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const subtotalAgregados =
      quote.extraTransport + quote.extraPackaging + quote.extraStaff + quote.extraOvertime + quote.extraOther;
    const totalAntesDescuento = subtotalProductos + subtotalAgregados;
    const descuentoAplicado = totalAntesDescuento * quote.discountPct;
    const total = totalAntesDescuento - descuentoAplicado;
    const pricePerPerson = quote.peopleCount ? total / quote.peopleCount : null;
    return { subtotalProductos, subtotalAgregados, totalAntesDescuento, descuentoAplicado, total, pricePerPerson };
  }

  async create(dto: CreateQuoteDto) {
    const businessLine = await this.prisma.businessLine.findUnique({ where: { id: dto.businessLineId } });
    if (!businessLine) throw new BadRequestException(`Línea de negocio con id "${dto.businessLineId}" no encontrada`);
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new BadRequestException(`Cliente con id "${dto.customerId}" no encontrado`);
    }
    const resolvedItems = await this.resolveItems(dto.items);

    const quote = await this.prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          businessLineId: dto.businessLineId,
          customerId: dto.customerId,
          clientName: dto.clientName,
          eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
          saleType: dto.saleType,
          peopleCount: dto.peopleCount,
          discountPct: dto.discountPct ?? 0,
          extraTransport: new Decimal(dto.extraTransport ?? 0),
          extraPackaging: new Decimal(dto.extraPackaging ?? 0),
          extraStaff: new Decimal(dto.extraStaff ?? 0),
          extraOvertime: new Decimal(dto.extraOvertime ?? 0),
          extraOther: new Decimal(dto.extraOther ?? 0),
          items: {
            create: resolvedItems.map((i) => ({
              productId: i.productId,
              channel: i.channel,
              quantity: i.quantity,
              unitPrice: new Decimal(i.unitPrice),
            })),
          },
        },
      });
      return created;
    });
    return this.findOne(quote.id);
  }

  async findAll(page: number = PAGINATION.defaultPage, limit: number = PAGINATION.defaultLimit, businessLineId?: string): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where = businessLineId ? { businessLineId } : {};
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { items: true, customer: { select: { id: true, name: true } } },
        skip,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);
    const data = rows.map((q) => {
      const items = q.items.map((i) => ({ ...i, quantity: i.quantity, unitPrice: Number(i.unitPrice) }));
      const totals = this.computeTotals(
        {
          discountPct: q.discountPct,
          extraTransport: Number(q.extraTransport),
          extraPackaging: Number(q.extraPackaging),
          extraStaff: Number(q.extraStaff),
          extraOvertime: Number(q.extraOvertime),
          extraOther: Number(q.extraOther),
          peopleCount: q.peopleCount,
        },
        items,
      );
      return { ...q, customer: q.customer, itemCount: q.items.length, totals };
    });
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true, unit: true } } } },
        customer: { select: { id: true, name: true } },
      },
    });
    if (!quote) throw new NotFoundException(`Presupuesto con id "${id}" no encontrado`);
    const items = quote.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) }));
    const totals = this.computeTotals(
      {
        discountPct: quote.discountPct,
        extraTransport: Number(quote.extraTransport),
        extraPackaging: Number(quote.extraPackaging),
        extraStaff: Number(quote.extraStaff),
        extraOvertime: Number(quote.extraOvertime),
        extraOther: Number(quote.extraOther),
        peopleCount: quote.peopleCount,
      },
      items,
    );
    return { ...quote, items, totals };
  }

  async update(id: string, dto: UpdateQuoteDto) {
    const existing = await this.prisma.quote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Presupuesto con id "${id}" no encontrado`);
    if (dto.customerId !== undefined) {
      if (dto.customerId) {
        const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
        if (!customer) throw new BadRequestException(`Cliente con id "${dto.customerId}" no encontrado`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: {
          ...(dto.customerId !== undefined && { customerId: dto.customerId }),
          ...(dto.clientName !== undefined && { clientName: dto.clientName }),
          ...(dto.eventDate !== undefined && { eventDate: dto.eventDate ? new Date(dto.eventDate) : null }),
          ...(dto.saleType !== undefined && { saleType: dto.saleType }),
          ...(dto.peopleCount !== undefined && { peopleCount: dto.peopleCount }),
          ...(dto.discountPct !== undefined && { discountPct: dto.discountPct }),
          ...(dto.extraTransport !== undefined && { extraTransport: new Decimal(dto.extraTransport) }),
          ...(dto.extraPackaging !== undefined && { extraPackaging: new Decimal(dto.extraPackaging) }),
          ...(dto.extraStaff !== undefined && { extraStaff: new Decimal(dto.extraStaff) }),
          ...(dto.extraOvertime !== undefined && { extraOvertime: new Decimal(dto.extraOvertime) }),
          ...(dto.extraOther !== undefined && { extraOther: new Decimal(dto.extraOther) }),
        },
      });

      if (dto.items !== undefined) {
        const resolvedItems = await this.resolveItems(dto.items);
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        if (resolvedItems.length > 0) {
          await tx.quoteItem.createMany({
            data: resolvedItems.map((i) => ({
              quoteId: id,
              productId: i.productId,
              channel: i.channel,
              quantity: i.quantity,
              unitPrice: new Decimal(i.unitPrice),
            })),
          });
        }
      }
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.prisma.quote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Presupuesto con id "${id}" no encontrado`);
    await this.prisma.$transaction([
      this.prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
      this.prisma.quote.delete({ where: { id } }),
    ]);
    return { success: true };
  }
}
