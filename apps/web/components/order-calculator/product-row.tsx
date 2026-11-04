"use client";

import { useState } from "react";
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
  productId,
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
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");

  const parsedWeight = Number(weightInput.replace(",", "."));
  const weightValid =
    weightInput.trim() !== "" && Number.isFinite(parsedWeight) && parsedWeight > 0;

  function openWeightModal() {
    setWeightInput(quantity > 0 ? String(quantity) : "");
    setWeightOpen(true);
  }

  function confirmWeight() {
    if (!weightValid) return;
    onQuantityChange(Math.round(parsedWeight * 1000) / 1000);
    setWeightOpen(false);
  }

  return (
    <div className={`oc-prow${quantity > 0 ? " has-qty" : ""}`}>
      <div
        className="oc-prow__info"
        style={isKg ? { cursor: "pointer" } : undefined}
        onClick={isKg ? openWeightModal : undefined}
      >
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

      {weightOpen && (
        <div className="ha-modal-backdrop" onClick={() => setWeightOpen(false)}>
          <div
            className="ha-modal"
            style={{ maxWidth: 380 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ha-modal__head">
              <span className="ha-modal__title">{productName}</span>
              <button
                className="ha-iconbtn"
                onClick={() => setWeightOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="ha-modal__body">
              <div className="ha-field">
                <label className="ha-label">Precio por kg</label>
                <div className="mono" style={{ fontSize: 16, marginBottom: 14 }}>
                  {formatCurrency(unitPrice)}
                </div>
                <label className="ha-label" htmlFor={`weight-${productId}`}>
                  Peso (kg)
                </label>
                <input
                  id={`weight-${productId}`}
                  className="ha-input"
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  placeholder="0,000"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmWeight();
                  }}
                />
              </div>
              <div className="oc-sum-totrow" style={{ marginTop: 14 }}>
                <span>Subtotal</span>
                <span className="mono">
                  {formatCurrency(weightValid ? parsedWeight * unitPrice : 0)}
                </span>
              </div>
            </div>
            <div className="ha-modal__foot">
              {quantity > 0 && (
                <button
                  className="ha-btn ha-btn--destructive"
                  onClick={() => {
                    onQuantityChange(0);
                    setWeightOpen(false);
                  }}
                >
                  Quitar
                </button>
              )}
              <button
                className="ha-btn ha-btn--secondary"
                onClick={() => setWeightOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="ha-btn ha-btn--primary"
                disabled={!weightValid}
                onClick={confirmWeight}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
