"use client";

import { getPriceForType, type PriceType } from "@/lib/order-calculator/price-types";
import type { Price } from "@/lib/types";
import { QuantityControl } from "./quantity-control";

interface ProductRowProps {
  productId: string;
  productName: string;
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
  const hasItems = quantity > 0;
  const showPromo = typeof unitPriceOverride === "number" && Math.abs(unitPriceOverride - list) > 0.02;

  return (
    <div className={`oc-pcard${hasItems ? " has" : ""}`}>
      <div className="oc-pcard__hd">
        <span className="oc-pcard__name">{productName}</span>
        {promoTag && showPromo && (
          <span className="oc-badge">{promoTag}</span>
        )}
      </div>
      <QuantityControl
        label="Unidad"
        price={unitPrice}
        quantity={quantity}
        onIncrement={() => onQuantityChange(quantity + 1)}
        onDecrement={() => onQuantityChange(Math.max(0, quantity - 1))}
        onBulkIncrement={() => onQuantityChange(quantity + 12)}
        onBulkDecrement={() => onQuantityChange(Math.max(0, quantity - 12))}
      />
    </div>
  );
}
