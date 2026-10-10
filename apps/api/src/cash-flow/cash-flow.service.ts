import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CashMovement, PaymentMethod, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { buildPaginatedResponse, PaginatedResponse } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  CASH_BOX_PAYER,
  CASH_FLOW_CATEGORIES,
  CASH_FLOW_PAYERS,
  CASH_FLOW_PAYMENT_METHODS,
  CASH_FLOW_REIMBURSEMENT_STATUSES,
  findCategory,
  OPEN_REIMBURSEMENT_STATUSES,
} from "./cash-flow.catalog";
import { CreateCashMovementDto } from "./dto/create-cash-movement.dto";
import { GetCashMovementsQueryDto } from "./dto/get-cash-movements-query.dto";
import { GetCashSummaryQueryDto } from "./dto/get-cash-summary-query.dto";
import { UpdateCashMovementDto } from "./dto/update-cash-movement.dto";
import { UpdateCashSnapshotDto } from "./dto/update-cash-snapshot.dto";

export type CashMovementResponse = {
  id: string;
  businessLineId: string;
  date: string;
  type: CashMovement["type"];
  category: string;
  classification: CashMovement["classification"];
  description: string;
  counterparty: string | null;
  amount: number;
  paymentMethod: string | null;
  status: CashMovement["status"];
  payer: string;
  reimbursementStatus: string | null;
  notes: string | null;
  needsReview: boolean;
};

export type CashSnapshotResponse = {
  cash: number;
  wallet: number;
  total: number;
  asOf: string;
} | null;

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function toResponse(m: CashMovement): CashMovementResponse {
  return {
    id: m.id,
    businessLineId: m.businessLineId,
    date: m.date.toISOString().slice(0, 10),
    type: m.type,
    category: m.category,
    classification: m.classification,
    description: m.description,
    counterparty: m.counterparty,
    amount: Number(m.amount),
    paymentMethod: m.paymentMethod,
    status: m.status,
    payer: m.payer,
    reimbursementStatus: m.reimbursementStatus,
    notes: m.notes,
    needsReview: m.needsReview,
  };
}

const orderPaymentKey = (paymentId: string) => `order-payment:${paymentId}`;

/** Fecha "YYYY-MM-DD" (o ISO) → medianoche UTC de ese día. */
function parseDay(value: string): Date {
  const d = new Date(value.slice(0, 10) + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) throw new BadRequestException("Fecha inválida");
  return d;
}

@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  getConfig() {
    return {
      categories: CASH_FLOW_CATEGORIES,
      paymentMethods: CASH_FLOW_PAYMENT_METHODS,
      payers: CASH_FLOW_PAYERS,
      reimbursementStatuses: CASH_FLOW_REIMBURSEMENT_STATUSES,
      defaultPayer: CASH_BOX_PAYER,
    };
  }

  async findAll(
    query: GetCashMovementsQueryDto,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<CashMovementResponse> & { totals: { income: number; expense: number } }> {
    const where: Prisma.CashMovementWhereInput = { businessLineId: query.businessLineId };
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: parseDay(query.from) } : {}),
        ...(query.to ? { lte: parseDay(query.to) } : {}),
      };
    }
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.needsReview) where.needsReview = true;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { counterparty: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const [rows, total, grouped] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cashMovement.count({ where }),
      this.prisma.cashMovement.groupBy({ by: ["type"], where, _sum: { amount: true } }),
    ]);

    const sumOf = (type: "INCOME" | "EXPENSE") =>
      Number(grouped.find((g) => g.type === type)?._sum.amount ?? 0);

    return {
      ...buildPaginatedResponse(rows.map(toResponse), total, page, limit),
      totals: { income: sumOf("INCOME"), expense: sumOf("EXPENSE") },
    };
  }

  async create(dto: CreateCashMovementDto): Promise<CashMovementResponse> {
    const category = this.resolveCategory(dto.category, dto.type);
    const row = await this.prisma.cashMovement.create({
      data: {
        businessLineId: dto.businessLineId,
        date: parseDay(dto.date),
        type: dto.type,
        category: category.name,
        classification: category.classification,
        description: dto.description.trim(),
        counterparty: dto.counterparty?.trim() || null,
        amount: new Decimal(dto.amount),
        paymentMethod: dto.paymentMethod ?? null,
        status: dto.status ?? "SETTLED",
        payer: dto.payer?.trim() || CASH_BOX_PAYER,
        reimbursementStatus: dto.reimbursementStatus ?? null,
        notes: dto.notes?.trim() || null,
        needsReview: dto.needsReview ?? false,
      },
    });
    return toResponse(row);
  }

  async update(id: string, dto: UpdateCashMovementDto): Promise<CashMovementResponse> {
    const current = await this.prisma.cashMovement.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`No existe el movimiento "${id}"`);

    const data: Prisma.CashMovementUpdateInput = {};
    const type = dto.type ?? current.type;
    if (dto.category !== undefined || dto.type !== undefined) {
      const category = this.resolveCategory(dto.category ?? current.category, type);
      data.category = category.name;
      data.classification = category.classification;
      data.type = type;
    }
    if (dto.date !== undefined) data.date = parseDay(dto.date);
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.counterparty !== undefined) data.counterparty = dto.counterparty.trim() || null;
    if (dto.amount !== undefined) data.amount = new Decimal(dto.amount);
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.payer !== undefined) data.payer = dto.payer.trim() || CASH_BOX_PAYER;
    if (dto.reimbursementStatus !== undefined) data.reimbursementStatus = dto.reimbursementStatus || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.needsReview !== undefined) data.needsReview = dto.needsReview;

    const row = await this.prisma.cashMovement.update({ where: { id }, data });
    return toResponse(row);
  }

  async remove(id: string): Promise<void> {
    const found = await this.prisma.cashMovement.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`No existe el movimiento "${id}"`);
    await this.prisma.cashMovement.delete({ where: { id } });
  }

  async getSnapshot(businessLineId: string): Promise<CashSnapshotResponse> {
    const row = await this.prisma.cashSnapshot.findFirst({
      where: { businessLineId },
      orderBy: [{ asOf: "desc" }, { createdAt: "desc" }],
    });
    if (!row) return null;
    const cash = Number(row.cash);
    const wallet = Number(row.wallet);
    return { cash, wallet, total: cash + wallet, asOf: row.asOf.toISOString().slice(0, 10) };
  }

  async saveSnapshot(dto: UpdateCashSnapshotDto): Promise<CashSnapshotResponse> {
    const asOf = dto.asOf ? parseDay(dto.asOf) : parseDay(new Date().toISOString());
    await this.prisma.cashSnapshot.create({
      data: {
        businessLineId: dto.businessLineId,
        cash: new Decimal(dto.cash),
        wallet: new Decimal(dto.wallet),
        asOf,
      },
    });
    return this.getSnapshot(dto.businessLineId);
  }

  async getSummary(query: GetCashSummaryQueryDto) {
    const { businessLineId } = query;
    const year = query.year ?? 0;
    const month = query.month ?? 0;

    const all = await this.prisma.cashMovement.findMany({
      where: { businessLineId },
      select: {
        date: true,
        type: true,
        category: true,
        classification: true,
        amount: true,
        status: true,
        payer: true,
        reimbursementStatus: true,
      },
    });

    const inPeriod = all.filter((m) => {
      if (year && m.date.getUTCFullYear() !== year) return false;
      if (month && m.date.getUTCMonth() + 1 !== month) return false;
      return true;
    });

    let income = 0;
    let operatingExpense = 0;
    let investmentExpense = 0;
    const byCategory = new Map<string, { type: string; classification: string; amount: number }>();
    for (const m of inPeriod) {
      const amount = Number(m.amount);
      if (m.type === "INCOME") income += amount;
      else if (m.classification === "INVESTMENT") investmentExpense += amount;
      else operatingExpense += amount;
      const entry = byCategory.get(m.category) ?? {
        type: m.type,
        classification: m.classification,
        amount: 0,
      };
      entry.amount += amount;
      byCategory.set(m.category, entry);
    }

    const categoryRows = (type: "INCOME" | "EXPENSE") => {
      const known = CASH_FLOW_CATEGORIES.filter((c) => c.type === type).map((c) => c.name);
      const extra = [...byCategory.entries()]
        .filter(([name, v]) => v.type === type && !known.includes(name))
        .map(([name]) => name);
      return [...known, ...extra].map((name) => {
        const v = byCategory.get(name);
        return {
          category: name,
          classification: v?.classification ?? findCategory(name)?.classification ?? "OPERATING",
          amount: v?.amount ?? 0,
        };
      });
    };

    const monthlyYear = year || new Date().getUTCFullYear();
    const monthly = MONTH_NAMES.map((label, i) => {
      let mIncome = 0;
      let mOperating = 0;
      let mInvestment = 0;
      for (const m of all) {
        if (m.date.getUTCFullYear() !== monthlyYear || m.date.getUTCMonth() !== i) continue;
        const amount = Number(m.amount);
        if (m.type === "INCOME") mIncome += amount;
        else if (m.classification === "INVESTMENT") mInvestment += amount;
        else mOperating += amount;
      }
      return {
        month: i + 1,
        label,
        income: mIncome,
        operatingExpense: mOperating,
        investmentExpense: mInvestment,
        operatingResult: mIncome - mOperating,
        totalResult: mIncome - mOperating - mInvestment,
      };
    });

    // Deudas con socios: histórico completo, independiente del período.
    const partners = new Map<string, { paidExpenses: number; collectedIncome: number }>();
    for (const m of all) {
      if (m.payer === CASH_BOX_PAYER) continue;
      if (!m.reimbursementStatus || !OPEN_REIMBURSEMENT_STATUSES.includes(m.reimbursementStatus)) continue;
      const entry = partners.get(m.payer) ?? { paidExpenses: 0, collectedIncome: 0 };
      if (m.type === "EXPENSE") entry.paidExpenses += Number(m.amount);
      else entry.collectedIncome += Number(m.amount);
      partners.set(m.payer, entry);
    }
    const partnerNames = [
      ...CASH_FLOW_PAYERS.filter((p) => p !== CASH_BOX_PAYER),
      ...[...partners.keys()].filter((p) => !(CASH_FLOW_PAYERS as readonly string[]).includes(p)),
    ];
    const partnerDebts = partnerNames.map((name) => {
      const v = partners.get(name) ?? { paidExpenses: 0, collectedIncome: 0 };
      return { partner: name, ...v, owed: v.paidExpenses - v.collectedIncome };
    });
    const partnerDebtTotal = partnerDebts.reduce((s, p) => s + p.owed, 0);

    const own = all.filter((m) => m.payer === CASH_BOX_PAYER && m.status === "PENDING");
    const pendingReceivable = own.filter((m) => m.type === "INCOME").reduce((s, m) => s + Number(m.amount), 0);
    const pendingPayable = own.filter((m) => m.type === "EXPENSE").reduce((s, m) => s + Number(m.amount), 0);

    // Capital parado: stock actual valuado al costo activo de cada producto.
    const stockProducts = await this.prisma.product.findMany({
      where: { businessLineId, stock: { gt: 0 } },
      select: {
        id: true,
        name: true,
        unit: true,
        stock: true,
        costs: { where: { deactivatedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { value: true } },
      },
    });
    const inventory = stockProducts
      .map((p) => {
        const unitCost = p.costs[0] ? Number(p.costs[0].value) : null;
        return {
          productId: p.id,
          name: p.name,
          unit: p.unit,
          quantity: p.stock,
          unitCost,
          value: unitCost === null ? 0 : p.stock * unitCost,
        };
      })
      .sort((a, b) => b.value - a.value);
    const inventoryValue = inventory.reduce((s, i) => s + i.value, 0);

    const snapshot = await this.getSnapshot(businessLineId);
    const cashTotal = snapshot?.total ?? 0;
    const operatingResult = income - operatingExpense;

    return {
      period: { year, month },
      monthlyYear,
      income,
      operatingExpense,
      investmentExpense,
      operatingResult,
      operatingMarginPct: income > 0 ? (operatingResult / income) * 100 : null,
      totalResult: operatingResult - investmentExpense,
      incomeByCategory: categoryRows("INCOME"),
      expenseByCategory: categoryRows("EXPENSE"),
      monthly,
      snapshot,
      partnerDebts,
      partnerDebtTotal,
      availableCash: cashTotal - partnerDebtTotal,
      pendingReceivable,
      pendingPayable,
      inventoryValue,
      inventory,
      reviewCount: await this.prisma.cashMovement.count({ where: { businessLineId, needsReview: true } }),
    };
  }

  /**
   * Refleja un pago de orden como ingreso cobrado. Solo aplica a Alumo (MEAT);
   * se llama dentro de la transacción que crea el pago. Idempotente por externalKey.
   */
  async recordOrderPayment(
    tx: Prisma.TransactionClient,
    payment: { id: string; amount: Decimal; method: PaymentMethod; createdAt: Date },
    order: {
      id: string;
      priceListType: string | null;
      customer: { name: string } | null;
      orderItems: { product: { businessLineId: string } }[];
    },
  ): Promise<void> {
    const businessLineId = order.orderItems[0]?.product.businessLineId;
    if (!businessLineId) return;
    const line = await tx.businessLine.findUnique({ where: { id: businessLineId }, select: { slug: true } });
    if (line?.slug !== "MEAT") return;

    const category = order.priceListType === "mayorista" ? "Venta Mayorista" : "Venta directa";
    const customer = order.customer?.name;
    const externalKey = orderPaymentKey(payment.id);
    await tx.cashMovement.upsert({
      where: { externalKey },
      create: {
        externalKey,
        businessLineId,
        date: parseDay(new Date(payment.createdAt.getTime() - 3 * 3600 * 1000).toISOString()), // día en Argentina (UTC-3)
        type: "INCOME",
        category,
        classification: "OPERATING",
        description: `Orden ${order.id.slice(0, 8)}${customer ? ` - ${customer}` : ""}`,
        counterparty: customer ?? null,
        amount: payment.amount,
        paymentMethod: payment.method === "CASH" ? "Efectivo" : "Transferencia",
        status: "SETTLED",
        payer: CASH_BOX_PAYER,
        notes: "Generado automáticamente desde una orden",
      },
      update: { paymentMethod: payment.method === "CASH" ? "Efectivo" : "Transferencia" },
    });
  }

  /** Mantiene el medio de pago del ingreso asociado cuando se edita el pago. */
  async syncOrderPaymentMethod(tx: Prisma.TransactionClient, paymentId: string, method: PaymentMethod): Promise<void> {
    await tx.cashMovement.updateMany({
      where: { externalKey: orderPaymentKey(paymentId) },
      data: { paymentMethod: method === "CASH" ? "Efectivo" : "Transferencia" },
    });
  }

  /** Borra los ingresos generados por los pagos de una orden que se elimina. */
  async removeOrderPayments(tx: Prisma.TransactionClient, paymentIds: string[]): Promise<void> {
    if (paymentIds.length === 0) return;
    await tx.cashMovement.deleteMany({
      where: { externalKey: { in: paymentIds.map(orderPaymentKey) } },
    });
  }

  private resolveCategory(name: string, type: "INCOME" | "EXPENSE") {
    const category = findCategory(name);
    if (!category) throw new BadRequestException(`Categoría inválida: "${name}"`);
    if (category.type !== type) {
      throw new BadRequestException(`La categoría "${name}" no corresponde a un ${type === "INCOME" ? "ingreso" : "egreso"}`);
    }
    return category;
  }
}
