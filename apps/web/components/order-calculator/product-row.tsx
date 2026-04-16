"use client";

import { getPriceForType, type PriceType } from "@/lib/order-calculator/price-types";
import type { Price } from "@/lib/types";
import { Card, Tag } from "antd";
import { QuantityControl } from "./quantity-control";

interface ProductRowProps {
  productId: string;
  productName: string;
  prices: Price[];
  priceType: PriceType;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  /** Si se pasa, reemplaza el precio de lista (p. ej. promo por umbral de compra). */
  unitPriceOverride?: number;
  /** Precio de lista (para mostrar tachado si hay promo). */
  listUnitPrice?: number;
  /** Texto corto junto al título (ej. promo activa). */
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
    <Card
      size="small"
      title={
        <span style={{ color: "#ffffff", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {productName}
          {promoTag && showPromo ? (
            <Tag color="green" style={{ margin: 0 }}>
              {promoTag}
            </Tag>
          ) : null}
        </span>
      }
      style={{
        backgroundColor: "#1f2937",
        borderColor: hasItems ? "rgba(34, 197, 94, 0.4)" : "#2d3748",
      }}
      styles={{ header: { borderColor: "#2d3748" } }}
    >
      <QuantityControl
        label="Unidad"
        price={unitPrice}
        quantity={quantity}
        onIncrement={() => onQuantityChange(quantity + 1)}
        onDecrement={() => onQuantityChange(Math.max(0, quantity - 1))}
        onBulkIncrement={() => onQuantityChange(quantity + 12)}
        onBulkDecrement={() => onQuantityChange(Math.max(0, quantity - 12))}
      />
    </Card>
  );
}
