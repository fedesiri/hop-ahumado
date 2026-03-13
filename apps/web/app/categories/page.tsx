'use client'

import React, { useState, useEffect } from 'react'
import { Button, Table, Modal, Form, Input, Space, Spin, Empty, App } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { AppLayout } from '@/components/app-layout'
import { LineProvider } from '@/lib/line-context'
import { apiClient } from '@/lib/api-client'
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/lib/types'

export default function CategoriesPage() {
  return (
    <LineProvider>
      <AppLayout>
        <CategoriesContent />
      </AppLayout>
    </LineProvider>
  )
}

function CategoriesContent() {
  const { message, modal } = App.useApp()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getCategories(1, 100)
      setCategories(response.data)
    } catch (error) {
      message.error('Error al cargar categorías')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: Category) => {
    setEditingId(record.id)
    form.setFieldsValue({ name: record.name })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Confirmar eliminacion',
      content: 'Estas seguro de que deseas eliminar esta categoria?',
      okText: 'Si',
      cancelText: 'No',
      onOk: async () => {
        try {
          await apiClient.deleteCategory(id)
          message.success('Categoria eliminada')
          fetchCategories()
        } catch (error) {
          message.error('Error al eliminar categoria')
        }
      },
    })
  }

  const handleSubmit = async (values: CreateCategoryRequest) => {
    try {
      if (editingId) {
        await apiClient.updateCategory(editingId, values as UpdateCategoryRequest)
        message.success('Categoría actualizada')
      } else {
        await apiClient.createCategory(values)
        message.success('Categoría creada')
      }
      setModalOpen(false)
      fetchCategories()
    } catch (error) {
      message.error('Error al guardar categoría')
    }
  }

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_: any, record: Category) => (
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
        <h1 style={{ margin: 0, color: '#ffffff' }}>Categorías</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nueva Categoría
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : categories.length > 0 ? (
        <Table
          columns={columns}
          dataSource={categories}
          rowKey="id"
          style={{ backgroundColor: '#1f2937' }}
        />
      ) : (
        <Empty description="No hay categorías" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title={editingId ? 'Editar Categoría' : 'Nueva Categoría'}
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
            <Input placeholder="Nombre de la categoría" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
