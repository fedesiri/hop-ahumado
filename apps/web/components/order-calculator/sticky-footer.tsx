'use client'

import { Button } from 'antd'
import { CopyOutlined, DeleteOutlined, RollbackOutlined, CheckCircleOutlined } from '@ant-design/icons'

interface StickyFooterProps {
  total: number
  hasItems: boolean
  onCopy: () => void
  onClear: () => void
  onNewOrder: () => void
  onConfirmOrder?: () => void
}

export function StickyFooter({
  total,
  hasItems,
  onCopy,
  onClear,
  onNewOrder,
  onConfirmOrder,
}: StickyFooterProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: '1px solid #2d3748',
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        backdropFilter: 'blur(8px)',
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>
            Total
          </span>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: total > 0 ? '#22c55e' : '#9ca3af',
            }}
          >
            $ {total.toLocaleString('es-AR')}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Button
            icon={<RollbackOutlined />}
            onClick={onNewOrder}
            title="Nuevo pedido"
          />
          <Button
            icon={<DeleteOutlined />}
            onClick={onClear}
            disabled={!hasItems}
            title="Limpiar"
          />
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={onCopy}
            disabled={!hasItems}
          >
            Copiar pedido
          </Button>
          {onConfirmOrder && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={onConfirmOrder}
              disabled={!hasItems}
            >
              Confirmar pedido (descontar stock)
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
