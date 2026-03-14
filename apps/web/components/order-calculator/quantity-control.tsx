'use client'

import { Button } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'

interface QuantityControlProps {
  label: string
  price: number
  quantity: number
  onIncrement: () => void
  onDecrement: () => void
  onBulkIncrement: () => void
  onBulkDecrement: () => void
}

function vibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(15)
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: '#ffffff' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          $ {price.toLocaleString('es-AR')}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Button
          size="small"
          onClick={() => {
            vibrate()
            onBulkDecrement()
          }}
          disabled={quantity < 12}
          style={{ minWidth: 40 }}
        >
          -12
        </Button>
        <Button
          size="small"
          icon={<MinusOutlined />}
          onClick={() => {
            vibrate()
            onDecrement()
          }}
          disabled={quantity === 0}
        />
        <span
          style={{
            minWidth: 44,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: quantity > 0 ? '#22c55e' : '#9ca3af',
          }}
        >
          {quantity}
        </span>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            vibrate()
            onIncrement()
          }}
        />
        <Button
          type="primary"
          size="small"
          onClick={() => {
            vibrate()
            onBulkIncrement()
          }}
          style={{ minWidth: 40 }}
        >
          +12
        </Button>
      </div>
    </div>
  )
}
