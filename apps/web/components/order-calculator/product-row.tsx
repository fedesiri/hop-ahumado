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
          disabled={quantity < 12}
          onClick={() => { vibrate(); onQuantityChange(Math.max(0, quantity - 12)); }}
          title="-12"
        >
          -12
        </button>
        <button
          className="oc-stepbtn"
          disabled={quantity === 0}
          onClick={() => { vibrate(); onQuantityChange(Math.max(0, quantity - 1)); }}
        >
          −
        </button>
        <div className={`oc-stepval${quantity > 0 ? " has" : ""}`}>{quantity}</div>
        <button
          className="oc-stepbtn oc-stepbtn--plus"
          onClick={() => { vibrate(); onQuantityChange(quantity + 1); }}
        >
          +
        </button>
        <button
          className="oc-stepbtn oc-stepbtn--bulk oc-stepbtn--plus"
          onClick={() => { vibrate(); onQuantityChange(quantity + 12); }}
          title="+12"
        >
          +12
        </button>
      </div>
    </div>
  );
}
