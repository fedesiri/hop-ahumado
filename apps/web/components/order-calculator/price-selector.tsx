'use client'

import { Segmented } from 'antd'
import {
  type PriceType,
  PRICE_TYPES,
  PRICE_TYPE_LABELS,
} from '@/lib/order-calculator/price-types'

interface PriceSelectorProps {
  selected: PriceType
  onSelect: (type: PriceType) => void
}

const OPTIONS = PRICE_TYPES.map((type) => ({
  label: PRICE_TYPE_LABELS[type],
  value: type,
}))

export function PriceSelector({ selected, onSelect }: PriceSelectorProps) {
  return (
    <div className="order-calc-price-segmented">
      <Segmented
        options={OPTIONS}
        value={selected}
        onChange={(value) => onSelect(value as PriceType)}
        block
      />
    </div>
  )
}
