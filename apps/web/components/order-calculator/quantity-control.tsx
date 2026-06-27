"use client";

import { formatCurrency } from "@/lib/format-currency";

interface QuantityControlProps {
  label: string;
  price: number;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onBulkIncrement: () => void;
  onBulkDecrement: () => void;
}

function vibrate() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(15);
  }
}

export function QuantityControl({
  label,
  price,
  quantity,
  onIncrement,
  onDecrement,
  onBulkIncrement,
  onBulkDecrement,
}: QuantityControlProps) {
  return (
    <div className="oc-stepper">
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div className="oc-pcard__price">{formatCurrency(price)}</div>
      </div>
      <div className="oc-nf" style={{ gap: 4 }}>
        <button
          className="oc-sbtn oc-sbtn--pm oc-sbtn--bulk"
          disabled={quantity < 12}
          onClick={() => { vibrate(); onBulkDecrement(); }}
        >
          -12
        </button>
        <button
          className="oc-sbtn oc-sbtn--pm"
          disabled={quantity === 0}
          onClick={() => { vibrate(); onDecrement(); }}
        >
          −
        </button>
        <span className={`oc-qty${quantity > 0 ? " pos" : ""}`}>{quantity}</span>
        <button
          className="oc-sbtn oc-sbtn--pm oc-sbtn--plus"
          onClick={() => { vibrate(); onIncrement(); }}
        >
          +
        </button>
        <button
          className="oc-sbtn oc-sbtn--pm oc-sbtn--plus oc-sbtn--bulk"
          onClick={() => { vibrate(); onBulkIncrement(); }}
        >
          +12
        </button>
      </div>
    </div>
  );
}
