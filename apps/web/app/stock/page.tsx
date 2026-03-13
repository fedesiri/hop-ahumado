'use client'

import React, { useState, useEffect } from 'react'
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Space,
  Spin,
  Empty,
  Select,
  InputNumber,
  Tag,
  App,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { AppLayout } from '@/components/app-layout'
import { LineProvider } from '@/lib/line-context'
import { apiClient } from '@/lib/api-client'
import type { StockMovement, Product, StockMovementType, PaginationMeta } from '@/lib/types'

export default function StockPage() {
  return (
    <LineProvider>
      <AppLayout>
        <StockContent />
      </AppLayout>
    </LineProvider>
  )
}

function StockContent() {
  const { message } = App.useApp()
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ page: 1, limit: 10 })
  const [meta, setMeta] = useState<PaginationMeta | null>(null)

  useEffect(() => {
    fetchMovements()
    fetchProducts()
  }, [pagination.page, pagination.limit])

  const fetchMovements = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getStockMovements(
        pagination.page,
        pagination.limit
      )
      setMovements(response.data)
      setMeta(response.meta)
    } catch (error) {
      message.error('Error al cargar movimientos')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await apiClient.getProducts(1, 100)
      setProducts(response.data)
    } catch (error) {
      console.error(error)
    }
  }

  const handleCreate = () => {
    form.resetFields()
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        productId: values.productId,
        quantity: values.quantity,
        type: values.type as StockMovementType,
        reason: values.reason,
      }

      await apiClient.createStockMovement(data)
      message.success('Movimiento de stock registrado')
      setModalOpen(false)
      fetchMovements()
    } catch (error) {
      message.error('Error al registrar movimiento')
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'IN':
        return 'green'
      case 'OUT':
        return 'red'
      case 'ADJUSTMENT':
        return 'orange'
      default:
        return 'default'
    }
  }

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'IN':
        return 'Entrada'
      case 'OUT':
        return 'Salida'
      case 'ADJUSTMENT':
        return 'Ajuste'
      default:
        return type
    }
  }

  const columns = [
    {
      title: 'Producto',
      dataIndex: ['product', 'name'],
      key: 'product',
      render: (text: string) => text || '-',
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={getMovementTypeColor(type)}>
          {getMovementTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Razón',
      dataIndex: 'reason',
      key: 'reason',
      render: (text: string) => text || '-',
    },
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('es-AR'),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, color: '#ffffff' }}>Movimientos de Stock</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Registrar Movimiento
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : movements.length > 0 ? (
        <Table
          columns={columns}
          dataSource={movements}
          rowKey="id"
          style={{ backgroundColor: '#1f2937' }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: meta?.total || 0,
            onChange: (page, pageSize) => {
              setPagination({ page, limit: pageSize })
            },
          }}
        />
      ) : (
        <Empty description="No hay movimientos de stock" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title="Registrar Movimiento de Stock"
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="productId"
            label="Producto"
            rules={[{ required: true, message: 'El producto es requerido' }]}
          >
            <Select
              placeholder="Selecciona un producto"
              options={products.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>

          <Form.Item
            name="type"
            label="Tipo de Movimiento"
            rules={[{ required: true, message: 'El tipo es requerido' }]}
          >
            <Select
              placeholder="Selecciona tipo"
              options={[
                { label: 'Entrada', value: 'IN' },
                { label: 'Salida', value: 'OUT' },
                { label: 'Ajuste', value: 'ADJUSTMENT' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Cantidad"
            rules={[
              { required: true, message: 'La cantidad es requerida' },
              { type: 'number', message: 'Debe ser un número' },
            ]}
          >
            <InputNumber placeholder="Cantidad" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Razón (Opcional)"
          >
            <Input placeholder="Razón del movimiento" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
