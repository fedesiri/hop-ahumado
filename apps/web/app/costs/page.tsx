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
import type { Cost, Product, CreateCostRequest, UpdateCostRequest } from '@/lib/types'

export default function CostsPage() {
  return (
    <LineProvider>
      <AppLayout>
        <CostsContent />
      </AppLayout>
    </LineProvider>
  )
}

function CostsContent() {
  const { message, modal } = App.useApp()
  const [costs, setCosts] = useState<Cost[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ page: 1, limit: 10 })
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null)
  const [showActive, setShowActive] = useState(true)

  useEffect(() => {
    fetchCosts()
    fetchProducts()
  }, [pagination.page, pagination.limit, showActive])

  const fetchCosts = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getCosts(
        pagination.page,
        pagination.limit,
        undefined,
        showActive
      )
      setCosts(response.data)
      setMeta(response.meta)
    } catch (error) {
      message.error('Error al cargar costos')
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

  const handleEdit = (record: Cost) => {
    setEditingId(record.id)
    form.setFieldsValue({
      productId: record.productId,
      value: record.value,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Confirmar eliminacion',
      content: 'Estas seguro de que deseas eliminar este costo?',
      okText: 'Si',
      cancelText: 'No',
      onOk: async () => {
        try {
          await apiClient.deleteCost(id)
          message.success('Costo eliminado')
          fetchCosts()
        } catch (error) {
          message.error('Error al eliminar costo')
        }
      },
    })
  }

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateCostRequest = {
        productId: values.productId,
        value: values.value,
      }

      if (editingId) {
        await apiClient.updateCost(editingId, data as UpdateCostRequest)
        message.success('Costo actualizado')
      } else {
        await apiClient.createCost(data)
        message.success('Costo creado')
      }
      setModalOpen(false)
      fetchCosts()
    } catch (error) {
      message.error('Error al guardar costo')
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
      title: 'Costo',
      dataIndex: 'value',
      key: 'value',
      render: (value: number | string) => `$${Number(value ?? 0).toFixed(2)}`,
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
      render: (_: any, record: Cost) => (
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
        <h1 style={{ margin: 0, color: '#ffffff' }}>Costos</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo Costo
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : costs.length > 0 ? (
        <Table
          columns={columns}
          dataSource={costs}
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
        <Empty description="No hay costos" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title={editingId ? 'Editar Costo' : 'Nuevo Costo'}
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
            label="Costo"
            rules={[{ required: true, message: 'El costo es requerido' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              placeholder="Costo del producto"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
