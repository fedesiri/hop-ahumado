'use client'

import { Card } from 'antd'
import { getPriceForType, type PriceType } from '@/lib/order-calculator/price-types'
import type { Price } from '@/lib/types'
import { QuantityControl } from './quantity-control'

interface ProductRowProps {
  productId: string
  productName: string
  prices: Price[]
  priceType: PriceType
  quantity: number
  onQuantityChange: (qty: number) => void
}

export function ProductRow({
  productName,
  prices,
  priceType,
  quantity,
  onQuantityChange,
}: ProductRowProps) {
  const unitPrice = getPriceForType(prices, priceType)
  const hasItems = quantity > 0

  return (
    <Card
      size="small"
      title={<span style={{ color: '#ffffff' }}>{productName}</span>}
      style={{
        backgroundColor: '#1f2937',
        borderColor: hasItems ? 'rgba(34, 197, 94, 0.4)' : '#2d3748',
      }}
      styles={{ header: { borderColor: '#2d3748' } }}
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
  )
}
