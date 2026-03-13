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
  Card,
  InputNumber,
  Tag,
  App,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { AppLayout } from '@/components/app-layout'
import { LineProvider } from '@/lib/line-context'
import { apiClient } from '@/lib/api-client'
import type { Product, Category, CreateProductRequest, UpdateProductRequest, PaginationMeta } from '@/lib/types'

export default function ProductsPage() {
  return (
    <LineProvider>
      <AppLayout>
        <ProductsContent />
      </AppLayout>
    </LineProvider>
  )
}

function ProductsContent() {
  const { message, modal } = App.useApp()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ page: 1, limit: 10 })
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [showDeactivated, setShowDeactivated] = useState(false)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [pagination.page, pagination.limit, showDeactivated])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getProducts(
        pagination.page,
        pagination.limit,
        showDeactivated
      )
      setProducts(response.data)
      setMeta(response.meta)
    } catch (error) {
      message.error('Error al cargar productos')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories(1, 100)
      setCategories(response.data)
    } catch (error) {
      console.error(error)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: Product) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      categoryId: record.categoryId,
      sku: record.sku,
      barcode: record.barcode,
      stock: record.stock,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Confirmar eliminacion',
      content: 'Estas seguro de que deseas eliminar este producto?',
      okText: 'Si',
      cancelText: 'No',
      onOk: async () => {
        try {
          await apiClient.deleteProduct(id)
          message.success('Producto eliminado')
          fetchProducts()
        } catch (error) {
          message.error('Error al eliminar producto')
        }
      },
    })
  }

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateProductRequest = {
        name: values.name,
        description: values.description,
        categoryId: values.categoryId,
        sku: values.sku,
        barcode: values.barcode,
        stock: values.stock || 0,
      }

      if (editingId) {
        await apiClient.updateProduct(editingId, data as UpdateProductRequest)
        message.success('Producto actualizado')
      } else {
        await apiClient.createProduct(data)
        message.success('Producto creado')
      }
      setModalOpen(false)
      fetchProducts()
    } catch (error) {
      message.error('Error al guardar producto')
    }
  }

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (text: string) => text || '-',
    },
    {
      title: 'Categoría',
      dataIndex: ['category', 'name'],
      key: 'category',
      render: (text: string) => text || '-',
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock: number) => (
        <Tag color={stock < 5 ? 'red' : stock < 10 ? 'orange' : 'green'}>
          {stock}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_: any, record: Product) => (
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
        <h1 style={{ margin: 0, color: '#ffffff' }}>Productos</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo Producto
        </Button>
      </div>

      <Card style={{ marginBottom: '16px', background: '#1f2937', borderColor: '#2d3748' }}>
        <Space>
          <Button
            type={showDeactivated ? 'primary' : 'default'}
            onClick={() => setShowDeactivated(!showDeactivated)}
          >
            {showDeactivated ? 'Mostrar activos' : 'Mostrar desactivados'}
          </Button>
        </Space>
      </Card>

      {loading ? (
        <Spin />
      ) : products.length > 0 ? (
        <Table
          columns={columns}
          dataSource={products}
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
        <Empty description="No hay productos" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title={editingId ? 'Editar Producto' : 'Nuevo Producto'}
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
            name="name"
            label="Nombre"
            rules={[{ required: true, message: 'El nombre es requerido' }]}
          >
            <Input placeholder="Nombre del producto" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Descripción"
          >
            <Input.TextArea placeholder="Descripción" rows={3} />
          </Form.Item>

          <Form.Item
            name="categoryId"
            label="Categoría"
          >
            <Select
              placeholder="Selecciona una categoría"
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>

          <Form.Item
            name="sku"
            label="SKU"
          >
            <Input placeholder="SKU" />
          </Form.Item>

          <Form.Item
            name="barcode"
            label="Código de Barras"
          >
            <Input placeholder="Código de barras" />
          </Form.Item>

          <Form.Item
            name="stock"
            label="Stock"
          >
            <InputNumber min={0} placeholder="Stock inicial" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
