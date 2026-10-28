import { Injectable } from "@nestjs/common";
import { StockMovementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StockValuationMixMode } from "./dto/get-stock-valuation-query.dto";

type PriceList = "fabrica" | "minorista" | "mayorista" | "catering";

/** Con menos unidades minorista+mayorista vendidas que esto, el producto usa el mix global. */
const MIN_PRODUCT_SAMPLE_UNITS = 12;
/** Tolerancia al comparar el precio de un ítem sin lista contra las listas de precios. */
const PRICE_MATCH_ABS = 0.5;
const PRICE_MATCH_REL = 0.005;
const AR_UTC_OFFSET = "-03:00";

export type MixSource = "product" | "global" | "none";

export interface StockValuationRow {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  factoryPrice: number | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
  /** Participación histórica de ventas minorista / mayorista (0..1) usada para el valor esperado. */
  retailShare: number | null;
  wholesaleShare: number | null;
  mixSource: MixSource;
  factoryValue: number;
  retailValue: number;
  wholesaleValue: number;
  expectedValue: number | null;
}

export interface StockValuationResponse {
  asOf: string;
  isToday: boolean;
  mixMode: StockValuationMixMode;
  totals: {
    factory: number;
    retail: number;
    wholesale: number;
    expected: number | null;
  };
  mix: {
    retailUnits: number;
    wholesaleUnits: number;
    retailPct: number | null;
    wholesalePct: number | null;
    /** Unidades vendidas a precio fábrica o catering (no entran al mix). */
    otherListUnits: number;
    /** Unidades sin lista identificable (no entran al mix). */
    unclassifiedUnits: number;
  };
  warnings: {
    /** Productos cuyo stock reconstruido dio negativo (se valoriza en 0). */
    negativeStockProducts: string[];
    /** Productos con stock sin ningún precio cargado en alguna de las tres listas. */
    missingPriceProducts: string[];
    /** Productos cuyo precio es anterior al primer registro de la lista: se usó el más antiguo conocido. */
    estimatedPriceProducts: string[];
  };
  rows: StockValuationRow[];
}

function normalizeList(description: string | null): PriceList | null {
  const key = (description ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return key === "fabrica" || key === "minorista" || key === "mayorista" || key === "catering" ? key : null;
}

/** Fin del día (hora Argentina) de `asOf`, acotado a "ahora". */
function resolveAsOfEnd(asOf: string | undefined, now: Date): Date {
  if (!asOf) return now;
  const end = new Date(`${asOf}T23:59:59.999${AR_UTC_OFFSET}`);
  if (Number.isNaN(end.getTime())) return now;
  return end > now ? now : end;
}

function movementDelta(type: StockMovementType, quantity: number): number {
  if (type === StockMovementType.OUT) return -quantity;
  if (type === StockMovementType.TRANSFER) return 0;
  return quantity;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class StockValuationService {
  constructor(private readonly prisma: PrismaService) {}

  async getValuation(
    businessLineId: string,
    asOf?: string,
    mixMode: StockValuationMixMode = "product",
  ): Promise<StockValuationResponse> {
    const now = new Date();
    const asOfEnd = resolveAsOfEnd(asOf, now);
    const isToday = asOfEnd.getTime() >= now.getTime();

    const products = await this.prisma.product.findMany({
      where: { businessLineId },
      select: { id: true, name: true, unit: true, prices: true },
      orderBy: { name: "asc" },
    });
    const productIds = products.map((p) => p.id);

    const [quantities, salesByProduct] = await Promise.all([
      this.quantitiesAt(businessLineId, asOfEnd, isToday),
      this.salesMixByProduct(productIds, asOfEnd),
    ]);

    const globalR = [...salesByProduct.values()].reduce((s, v) => s + v.retail, 0);
    const globalW = [...salesByProduct.values()].reduce((s, v) => s + v.wholesale, 0);
    const otherListUnits = [...salesByProduct.values()].reduce((s, v) => s + v.other, 0);
    const unclassifiedUnits = [...salesByProduct.values()].reduce((s, v) => s + v.unclassified, 0);
    const globalShare = globalR + globalW > 0 ? { retail: globalR / (globalR + globalW), wholesale: globalW / (globalR + globalW) } : null;

    const negativeStockProducts: string[] = [];
    const missingPriceProducts: string[] = [];
    const estimatedPriceProducts: string[] = [];
    const rows: StockValuationRow[] = [];

    for (const p of products) {
      const raw = quantities.get(p.id) ?? 0;
      if (raw < 0) negativeStockProducts.push(p.name);
      const quantity = Math.max(0, raw);
      if (quantity <= 0) continue;

      const { prices, estimated } = this.pricesAt(p.prices, asOfEnd);
      if (prices.fabrica == null || prices.minorista == null || prices.mayorista == null) {
        missingPriceProducts.push(p.name);
      }
      if (estimated) estimatedPriceProducts.push(p.name);

      const sales = salesByProduct.get(p.id);
      const own =
        mixMode === "product" && sales && sales.retail + sales.wholesale >= MIN_PRODUCT_SAMPLE_UNITS ? sales : null;
      let share: { retail: number; wholesale: number } | null = null;
      let mixSource: MixSource = "none";
      if (own) {
        share = { retail: own.retail / (own.retail + own.wholesale), wholesale: own.wholesale / (own.retail + own.wholesale) };
        mixSource = "product";
      } else if (globalShare) {
        share = globalShare;
        mixSource = "global";
      }

      const retailValue = quantity * (prices.minorista ?? 0);
      const wholesaleValue = quantity * (prices.mayorista ?? 0);
      rows.push({
        productId: p.id,
        name: p.name,
        unit: p.unit,
        quantity,
        factoryPrice: prices.fabrica,
        retailPrice: prices.minorista,
        wholesalePrice: prices.mayorista,
        retailShare: share?.retail ?? null,
        wholesaleShare: share?.wholesale ?? null,
        mixSource,
        factoryValue: round2(quantity * (prices.fabrica ?? 0)),
        retailValue: round2(retailValue),
        wholesaleValue: round2(wholesaleValue),
        expectedValue: share ? round2(share.retail * retailValue + share.wholesale * wholesaleValue) : null,
      });
    }

    const sum = (pick: (r: StockValuationRow) => number) => round2(rows.reduce((s, r) => s + pick(r), 0));
    const allHaveExpected = rows.every((r) => r.expectedValue != null);

    return {
      asOf: asOfEnd.toISOString(),
      isToday,
      mixMode,
      totals: {
        factory: sum((r) => r.factoryValue),
        retail: sum((r) => r.retailValue),
        wholesale: sum((r) => r.wholesaleValue),
        expected: allHaveExpected ? sum((r) => r.expectedValue ?? 0) : null,
      },
      mix: {
        retailUnits: globalR,
        wholesaleUnits: globalW,
        retailPct: globalShare ? globalShare.retail : null,
        wholesalePct: globalShare ? globalShare.wholesale : null,
        otherListUnits,
        unclassifiedUnits,
      },
      warnings: { negativeStockProducts, missingPriceProducts, estimatedPriceProducts },
      rows,
    };
  }

  /**
   * Stock total por producto a `asOfEnd`: saldo actual menos el efecto de los movimientos posteriores.
   * No depende de que el historial cierre desde cero, solo de que los cambios posteriores estén registrados.
   */
  private async quantitiesAt(businessLineId: string, asOfEnd: Date, isToday: boolean): Promise<Map<string, number>> {
    const balances = await this.prisma.stockBalance.groupBy({
      by: ["productId"],
      where: { product: { businessLineId } },
      _sum: { quantity: true },
    });
    const result = new Map(balances.map((b) => [b.productId, b._sum.quantity ?? 0]));
    if (isToday) return result;

    const later = await this.prisma.stockMovement.findMany({
      where: { product: { businessLineId }, createdAt: { gt: asOfEnd } },
      select: { productId: true, type: true, quantity: true },
    });
    for (const m of later) {
      result.set(m.productId, (result.get(m.productId) ?? 0) - movementDelta(m.type, m.quantity));
    }
    return result;
  }

  /**
   * Precio vigente por lista a `asOfEnd`; si hay varios activos de la misma lista gana el más reciente.
   * Si la fecha es anterior al primer registro de una lista, se usa el más antiguo y se marca `estimated`.
   */
  private pricesAt(
    prices: { value: unknown; description: string | null; createdAt: Date; deactivatedAt: Date | null }[],
    asOfEnd: Date,
  ): { prices: Record<PriceList, number | null>; estimated: boolean } {
    const out: Record<PriceList, number | null> = { fabrica: null, minorista: null, mayorista: null, catering: null };
    const earliest: Record<PriceList, number | null> = { fabrica: null, minorista: null, mayorista: null, catering: null };
    const sorted = [...prices].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const pr of sorted) {
      const list = normalizeList(pr.description);
      if (!list) continue;
      if (earliest[list] == null) earliest[list] = Number(pr.value);
      if (pr.createdAt > asOfEnd) continue;
      if (pr.deactivatedAt && pr.deactivatedAt <= asOfEnd) continue;
      out[list] = Number(pr.value);
    }
    let estimated = false;
    for (const list of ["fabrica", "minorista", "mayorista"] as const) {
      if (out[list] == null && earliest[list] != null) {
        out[list] = earliest[list];
        estimated = true;
      }
    }
    return { prices: out, estimated };
  }

  /**
   * Unidades vendidas por producto hasta `asOfEnd`, separadas en minorista / mayorista / otras listas.
   * Los pedidos previos al campo `priceListType` se clasifican por coincidencia del precio del ítem con
   * alguna versión de las listas del producto.
   */
  private async salesMixByProduct(
    productIds: string[],
    asOfEnd: Date,
  ): Promise<Map<string, { retail: number; wholesale: number; other: number; unclassified: number }>> {
    const items = await this.prisma.orderItem.findMany({
      where: { productId: { in: productIds }, order: { createdAt: { lte: asOfEnd } } },
      select: {
        productId: true,
        quantity: true,
        price: true,
        order: { select: { priceListType: true, isConsignment: true, cancelledAt: true } },
      },
    });
    const prices = await this.prisma.price.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, value: true, description: true },
    });
    const pricesByProduct = new Map<string, { list: PriceList; value: number }[]>();
    for (const pr of prices) {
      const list = normalizeList(pr.description);
      if (!list) continue;
      const arr = pricesByProduct.get(pr.productId) ?? [];
      arr.push({ list, value: Number(pr.value) });
      pricesByProduct.set(pr.productId, arr);
    }

    const result = new Map<string, { retail: number; wholesale: number; other: number; unclassified: number }>();
    for (const it of items) {
      if (it.order.cancelledAt && it.order.cancelledAt <= asOfEnd) continue;
      // Consignación sin precio fijado todavía: la mercadería no se vendió.
      if (it.order.isConsignment && it.price == null) continue;

      const entry = result.get(it.productId) ?? { retail: 0, wholesale: 0, other: 0, unclassified: 0 };
      result.set(it.productId, entry);
      const qty = Number(it.quantity);

      let list = normalizeList(it.order.priceListType);
      if (!list && it.price != null) {
        const unit = Number(it.price);
        const tol = Math.max(PRICE_MATCH_ABS, unit * PRICE_MATCH_REL);
        const hits = new Set(
          (pricesByProduct.get(it.productId) ?? []).filter((p) => Math.abs(p.value - unit) <= tol).map((p) => p.list),
        );
        if (hits.size === 1) list = [...hits][0];
      }

      if (list === "minorista") entry.retail += qty;
      else if (list === "mayorista") entry.wholesale += qty;
      else if (list) entry.other += qty;
      else entry.unclassified += qty;
    }
    return result;
  }
}
