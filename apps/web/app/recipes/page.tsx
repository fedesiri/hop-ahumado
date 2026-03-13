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
  Card,
  Row,
  Col,
  App,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { AppLayout } from '@/components/app-layout'
import { LineProvider } from '@/lib/line-context'
import { apiClient } from '@/lib/api-client'
import type { RecipeItem, Product, CreateRecipeItemRequest, UpdateRecipeItemRequest } from '@/lib/types'

export default function RecipesPage() {
  return (
    <LineProvider>
      <AppLayout>
        <RecipesContent />
      </AppLayout>
    </LineProvider>
  )
}

function RecipesContent() {
  const { message, modal } = App.useApp()
  const [recipes, setRecipes] = useState<RecipeItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ page: 1, limit: 10 })
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  useEffect(() => {
    fetchRecipes()
    fetchProducts()
  }, [pagination.page, pagination.limit, selectedProductId])

  const fetchRecipes = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getRecipeItems(
        pagination.page,
        pagination.limit,
        selectedProductId || undefined
      )
      setRecipes(response.data)
      setMeta(response.meta)
    } catch (error) {
      message.error('Error al cargar recetas')
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

  const handleEdit = (record: RecipeItem) => {
    setEditingId(record.id)
    form.setFieldsValue({
      productId: record.productId,
      ingredientId: record.ingredientId,
      quantity: record.quantity,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Confirmar eliminacion',
      content: 'Estas seguro de que deseas eliminar este item de receta?',
      okText: 'Si',
      cancelText: 'No',
      onOk: async () => {
        try {
          await apiClient.deleteRecipeItem(id)
          message.success('Item de receta eliminado')
          fetchRecipes()
        } catch (error) {
          message.error('Error al eliminar item')
        }
      },
    })
  }

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateRecipeItemRequest = {
        productId: values.productId,
        ingredientId: values.ingredientId,
        quantity: values.quantity,
      }

      if (editingId) {
        await apiClient.updateRecipeItem(editingId, data as UpdateRecipeItemRequest)
        message.success('Ítem de receta actualizado')
      } else {
        await apiClient.createRecipeItem(data)
        message.success('Ítem de receta creado')
      }
      setModalOpen(false)
      fetchRecipes()
    } catch (error) {
      message.error('Error al guardar ítem de receta')
    }
  }

  const columns = [
    {
      title: 'Producto (Receta)',
      dataIndex: ['product', 'name'],
      key: 'product',
      render: (text: string) => text || '-',
    },
    {
      title: 'Ingrediente',
      dataIndex: ['ingredient', 'name'],
      key: 'ingredient',
      render: (text: string) => text || '-',
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
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
      render: (_: any, record: RecipeItem) => (
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
        <h1 style={{ margin: 0, color: '#ffffff' }}>Recetas</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Agregar Ingrediente
        </Button>
      </div>

      <Card style={{ marginBottom: '16px', background: '#1f2937', borderColor: '#2d3748' }}>
        <Row gutter={16}>
          <Col span={12}>
            <label style={{ color: '#9ca3af', display: 'block', marginBottom: '8px' }}>
              Filtrar por Producto (Receta)
            </label>
            <Select
              allowClear
              placeholder="Selecciona un producto"
              options={products.map((p) => ({ label: p.name, value: p.id }))}
              value={selectedProductId}
              onChange={(value) => {
                setSelectedProductId(value)
                setPagination({ page: 1, limit: 10 })
              }}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </Card>

      {loading ? (
        <Spin />
      ) : recipes.length > 0 ? (
        <Table
          columns={columns}
          dataSource={recipes}
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
        <Empty description="No hay ítems de receta" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title={editingId ? 'Editar Ingrediente' : 'Agregar Ingrediente'}
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
            label="Producto (Receta)"
            rules={[{ required: true, message: 'El producto es requerido' }]}
          >
            <Select
              placeholder="Selecciona un producto"
              options={products.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>

          <Form.Item
            name="ingredientId"
            label="Ingrediente"
            rules={[{ required: true, message: 'El ingrediente es requerido' }]}
          >
            <Select
              placeholder="Selecciona un ingrediente"
              options={products.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Cantidad"
            rules={[{ required: true, message: 'La cantidad es requerida' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              placeholder="Cantidad del ingrediente"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
