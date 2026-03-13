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
  App,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { AppLayout } from '@/components/app-layout'
import { LineProvider } from '@/lib/line-context'
import { apiClient } from '@/lib/api-client'
import type { Price, Product, CreatePriceRequest, UpdatePriceRequest } from '@/lib/types'

export default function PricesPage() {
  return (
    <LineProvider>
      <AppLayout>
        <PricesContent />
      </AppLayout>
    </LineProvider>
  )
}

function PricesContent() {
  const { message, modal } = App.useApp()
  const [prices, setPrices] = useState<Price[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ page: 1, limit: 10 })
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null)
  const [showActive, setShowActive] = useState(true)

  useEffect(() => {
    fetchPrices()
    fetchProducts()
  }, [pagination.page, pagination.limit, showActive])

  const fetchPrices = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getPrices(
        pagination.page,
        pagination.limit,
        undefined,
        showActive
      )
      setPrices(response.data)
      setMeta(response.meta)
    } catch (error) {
      message.error('Error al cargar precios')
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
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: Price) => {
    setEditingId(record.id)
    form.setFieldsValue({
      productId: record.productId,
      value: record.value,
      description: record.description,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Confirmar eliminacion',
      content: 'Estas seguro de que deseas eliminar este precio?',
      okText: 'Si',
      cancelText: 'No',
      onOk: async () => {
        try {
          await apiClient.deletePrice(id)
          message.success('Precio eliminado')
          fetchPrices()
        } catch (error) {
          message.error('Error al eliminar precio')
        }
      },
    })
  }

  const handleSubmit = async (values: any) => {
    try {
      const data: CreatePriceRequest = {
        productId: values.productId,
        value: values.value,
        description: values.description,
      }

      if (editingId) {
        await apiClient.updatePrice(editingId, data as UpdatePriceRequest)
        message.success('Precio actualizado')
      } else {
        await apiClient.createPrice(data)
        message.success('Precio creado')
      }
      setModalOpen(false)
      fetchPrices()
    } catch (error) {
      message.error('Error al guardar precio')
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
      title: 'Valor',
      dataIndex: 'value',
      key: 'value',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: 'Fecha de Creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('es-AR'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_: any, record: Price) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, color: '#ffffff' }}>Precios</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo Precio
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : prices.length > 0 ? (
        <Table
          columns={columns}
          dataSource={prices}
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
        <Empty description="No hay precios" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title={editingId ? 'Editar Precio' : 'Nuevo Precio'}
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
            name="value"
            label="Valor"
            rules={[{ required: true, message: 'El valor es requerido' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              placeholder="Valor del producto"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Descripción"
          >
            <Input placeholder="Descripción (ej. Promoción, Mayorista)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
