"use client";

import { type PriceType, PRICE_TYPES, PRICE_TYPE_LABELS } from "@/lib/order-calculator/price-types";

interface PriceSelectorProps {
  selected: PriceType;
  onSelect: (type: PriceType) => void;
}

export function PriceSelector({ selected, onSelect }: PriceSelectorProps) {
  return (
    <div className="oc-seg">
      {PRICE_TYPES.map((type) => (
        <button
          key={type}
          className={`oc-seg__o${selected === type ? " act" : ""}`}
          onClick={() => onSelect(type)}
        >
          {PRICE_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
