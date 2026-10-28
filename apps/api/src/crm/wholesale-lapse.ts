import { PrismaService } from "../prisma/prisma.service";

/** Días sin comprar a partir de los cuales un cliente mayorista se considera "sin comprar". */
export const LAPSE_DAYS = Number(process.env.CUSTOMER_LAPSE_DAYS ?? 30);
const WHOLESALE_TYPE = /mayorista|empresa|distribuidor|b2b/i;
const NON_WHOLESALE_TYPE = /particular|minorista|consumidor|b2c/i;

export type LapsedWholesaleCustomer = {
  profileId: string;
  customerName: string;
  /** Días desde la última compra; sin compras, desde que se cargó el cliente al CRM. */
  daysSincePurchase: number;
  /** null si el cliente nunca compró. */
  lastPurchaseAt: string | null;
  /** Fecha desde la que se mide (última compra o alta del perfil). */
  referenceDate: Date;
};

/**
 * Clientes mayoristas con LAPSE_DAYS o más sin comprar (última compra = `deliveryDate` de pedidos no
 * cancelados). Es mayorista si su tipo en el CRM es Mayorista / Empresa; si no tiene tipo reconocible,
 * si alguna vez compró con lista mayorista. Los que nunca compraron cuentan desde que se cargaron al CRM.
 */
export async function findLapsedWholesaleCustomers(
  prisma: PrismaService,
  now: Date = new Date(),
): Promise<LapsedWholesaleCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: { profile: { isNot: null } },
    select: {
      name: true,
      profile: { select: { id: true, customerType: true, createdAt: true } },
      orders: { where: { cancelledAt: null }, select: { deliveryDate: true, priceListType: true } },
    },
  });

  const lapsed: LapsedWholesaleCustomer[] = [];
  for (const c of customers) {
    if (!c.profile) continue;
    const type = c.profile.customerType ?? "";
    const isWholesale = WHOLESALE_TYPE.test(type)
      ? true
      : NON_WHOLESALE_TYPE.test(type)
        ? false
        : c.orders.some((o) => o.priceListType === "mayorista");
    if (!isWholesale) continue;

    const lastPurchase =
      c.orders.length > 0 ? new Date(Math.max(...c.orders.map((o) => o.deliveryDate.getTime()))) : null;
    const referenceDate = lastPurchase ?? c.profile.createdAt;
    const days = Math.floor((now.getTime() - referenceDate.getTime()) / 86_400_000);
    if (days < LAPSE_DAYS) continue;
    lapsed.push({
      profileId: c.profile.id,
      customerName: c.name,
      daysSincePurchase: days,
      lastPurchaseAt: lastPurchase?.toISOString() ?? null,
      referenceDate,
    });
  }
  return lapsed.sort((a, b) => a.daysSincePurchase - b.daysSincePurchase);
}
