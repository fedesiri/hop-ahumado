import { Injectable } from "@nestjs/common";
import { computeOrderFields } from "../order/order-computed-properties";
import { OrderPaymentStatus } from "../order/order-payment-status.enum";
import { PrismaService } from "../prisma/prisma.service";

const PROMO_NAMES = new Set(["estuche/copa", "estuche/vaso"]);

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
}

function linePaymentRatio(
  items: { quantity: number; price: { toNumber(): number } | null; product: { businessLineId: string } }[],
  total: number,
  businessLineId: string,
): number {
  const lineSubtotal = items
    .filter((i) => i.product.businessLineId === businessLineId)
    .reduce((s, i) => s + i.quantity * (i.price ? i.price.toNumber() : 0), 0);
  if (!total) return 0;
  return Math.min(lineSubtotal / total, 1);
}

export type DashboardResult = {
  totalOrders: number;
  totalCustomers: number;
  lowStockProducts: { id: string; name: string; stock: number; unit: string; category: { name: string } | null }[];
  pendingDeliveries: {
    id: string;
    customer: { id: string; name: string } | null;
    total: number;
    paymentStatus: string;
    deliveryDate: string;
    createdAt: string;
  }[];
  baseline: { openingCash: number; openingCard: number; deltaSince: string; updatedAt: string } | null;
  cash: {
    deltaCashIn: number;
    deltaCashOut: number;
    deltaCardIn: number;
    deltaCardOut: number;
    balanceCash: number;
    balanceCard: number;
    total: number;
  } | null;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(businessLineId?: string, localMidnight?: Date): Promise<DashboardResult> {
    const orderWhere = businessLineId
      ? { orderItems: { some: { product: { businessLineId } } } }
      : {};
    const expenseWhere = businessLineId ? { businessLineId } : {};
    const productWhere = businessLineId
      ? { businessLineId, stock: { lt: 12 } }
      : { stock: { lt: 12 } };

    const [orders, expenses, products, totalCustomers, baseline] = await Promise.all([
      this.prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: "desc" },
        include: {
          orderItems: {
            select: {
              quantity: true,
              price: true,
              product: { select: { businessLineId: true } },
            },
          },
          payments: { select: { method: true, amount: true } },
          customer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.expense.findMany({
        where: expenseWhere,
        select: { method: true, amount: true, createdAt: true },
      }),
      this.prisma.product.findMany({
        where: productWhere,
        select: { id: true, name: true, stock: true, unit: true, category: { select: { name: true } } },
      }),
      this.prisma.customer.count(),
      businessLineId
        ? this.prisma.treasuryBaseline.findUnique({ where: { businessLineId } })
        : Promise.resolve(null),
    ]);

    const enriched = orders.map((o) => ({ ...o, ...computeOrderFields(o) }));

    const cutoff = localMidnight ?? new Date(new Date().setUTCHours(0, 0, 0, 0));
    const pendingDeliveries = enriched
      .filter((o) => {
        if (!o.deliveryDate) return false;
        if (new Date(o.deliveryDate).getTime() < cutoff.getTime()) return false;
        if (o.isDelivered && o.paymentStatus === OrderPaymentStatus.PAID) return false;
        return true;
      })
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        customer: o.customer,
        total: Number(o.total ?? o.totalPrice),
        paymentStatus: o.paymentStatus as string,
        deliveryDate: o.deliveryDate!.toISOString(),
        createdAt: o.createdAt.toISOString(),
      }));

    const lowStockProducts = products.filter((p) => !PROMO_NAMES.has(normalizeName(p.name)));

    let cash: DashboardResult["cash"] = null;
    if (baseline) {
      const since = baseline.deltaSince;

      let deltaCashIn = 0;
      let deltaCardIn = 0;
      for (const o of enriched) {
        if (o.createdAt < since) continue;
        const ratio = businessLineId
          ? linePaymentRatio(o.orderItems, Number(o.total ?? 0), businessLineId)
          : 1;
        for (const p of o.payments) {
          const amt = Number(p.amount) * ratio;
          if (p.method === "CASH") deltaCashIn += amt;
          else if (p.method === "CARD") deltaCardIn += amt;
        }
      }

      let deltaCashOut = 0;
      let deltaCardOut = 0;
      for (const e of expenses) {
        if (e.createdAt < since) continue;
        if (e.method === "CASH") deltaCashOut += Number(e.amount);
        else if (e.method === "CARD") deltaCardOut += Number(e.amount);
      }

      const balanceCash = Number(baseline.openingCash) + deltaCashIn - deltaCashOut;
      const balanceCard = Number(baseline.openingCard) + deltaCardIn - deltaCardOut;
      cash = { deltaCashIn, deltaCashOut, deltaCardIn, deltaCardOut, balanceCash, balanceCard, total: balanceCash + balanceCard };
    }

    return {
      totalOrders: orders.length,
      totalCustomers,
      lowStockProducts,
      pendingDeliveries,
      baseline: baseline
        ? {
            openingCash: Number(baseline.openingCash),
            openingCard: Number(baseline.openingCard),
            deltaSince: baseline.deltaSince.toISOString(),
            updatedAt: baseline.updatedAt.toISOString(),
          }
        : null,
      cash,
    };
  }
}
