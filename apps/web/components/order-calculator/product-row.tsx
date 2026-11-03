"use client";

import { formatCurrency } from "@/lib/format-currency";
import { getPriceForType, type PriceType } from "@/lib/order-calculator/price-types";
import { ProductUnit, type Price } from "@/lib/types";

const UNIT_LABELS: Record<string, string> = {
  [ProductUnit.UNIT]: "UN",
  [ProductUnit.KG]: "KG",
  [ProductUnit.G]: "G",
  [ProductUnit.L]: "L",
  [ProductUnit.ML]: "ML",
};

function stkClass(stock: number) {
  if (stock < 5) return "oc-stk oc-stk--red";
  if (stock < 10) return "oc-stk oc-stk--orange";
  return "oc-stk oc-stk--green";
}

function vibrate() {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
}

interface ProductRowProps {
  productId: string;
  productName: string;
  category?: string | null;
  unit: string;
  stock: number;
  prices: Price[];
  priceType: PriceType;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  unitPriceOverride?: number;
  listUnitPrice?: number;
  promoTag?: string;
}

export function ProductRow({
  productName,
  category,
  unit,
  stock,
  prices,
  priceType,
  quantity,
  onQuantityChange,
  unitPriceOverride,
  listUnitPrice,
  promoTag,
}: ProductRowProps) {
  const list = listUnitPrice ?? getPriceForType(prices, priceType);
  const unitPrice = unitPriceOverride ?? list;
  const unitLabel = UNIT_LABELS[unit] ?? unit;
  const meta = [category, unitLabel].filter(Boolean).join(" · ");
  // Productos por kilo se venden en envases de medio kilo: paso de 0,5 y salto de 1 kg.
  const isKg = unit === ProductUnit.KG;
  const step = isKg ? 0.5 : 1;
  const bulk = isKg ? 1 : 12;

  return (
    <div className={`oc-prow${quantity > 0 ? " has-qty" : ""}`}>
      <div className="oc-prow__info">
        <div className="oc-prow__name">
          {productName}
          {promoTag && <span className="oc-badge">{promoTag}</span>}
          <span className={stkClass(stock)}>{stock}</span>
        </div>
        <div className="oc-prow__meta">
          {meta}
          <span className="oc-prow__meta-price"> · {formatCurrency(unitPrice)}</span>
        </div>
      </div>

      <div className="oc-prow__price">{formatCurrency(unitPrice)}</div>

      <div className="oc-stepwrap">
        <button
          className="oc-stepbtn oc-stepbtn--bulk"
          disabled={quantity < bulk}
          onClick={() => { vibrate(); onQuantityChange(Math.max(0, quantity - bulk)); }}
          title={`-${bulk}`}
        >
          -{bulk}
        </button>
        <button
          className="oc-stepbtn"
          disabled={quantity === 0}
          onClick={() => { vibrate(); onQuantityChange(Math.max(0, quantity - step)); }}
        >
          −
        </button>
        <div className={`oc-stepval${quantity > 0 ? " has" : ""}`}>{quantity}</div>
        <button
          className="oc-stepbtn oc-stepbtn--plus"
          onClick={() => { vibrate(); onQuantityChange(quantity + step); }}
        >
          +
        </button>
        <button
          className="oc-stepbtn oc-stepbtn--bulk oc-stepbtn--plus"
          onClick={() => { vibrate(); onQuantityChange(quantity + bulk); }}
          title={`+${bulk}`}
        >
          +{bulk}
        </button>
      </div>
    </div>
  );
}
