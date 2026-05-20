'use client'

import { AppLayout } from '@/components/app-layout'
import { apiClient } from '@/lib/api-client'
import { useLineContext } from '@/lib/line-context'
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/lib/types'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Empty, Form, Input, Modal, Space, Spin, Table } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'

export default function CategoriesPage() {
  return (
    <AppLayout>
      <CategoriesContent />
    </AppLayout>
  )
}

function CategoriesContent() {
  const { message, modal } = App.useApp()
  const { selectedLineId } = useLineContext()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apiClient.getCategories(1, 100, selectedLineId ?? undefined)
      setCategories(response.data)
    } catch {
      message.error('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }, [selectedLineId, message])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

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
        } catch {
          message.error('Error al eliminar categoria')
        }
      },
    })
  }

  const handleSubmit = async (values: { name: string }) => {
    if (!selectedLineId) {
      message.error('Seleccioná una línea de negocio')
      return
    }
    try {
      if (editingId) {
        await apiClient.updateCategory(editingId, { name: values.name } as UpdateCategoryRequest)
        message.success('Categoría actualizada')
      } else {
        const payload: CreateCategoryRequest = { businessLineId: selectedLineId, name: values.name }
        await apiClient.createCategory(payload)
        message.success('Categoría creada')
      }
      setModalOpen(false)
      fetchCategories()
    } catch {
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
      render: (_: unknown, record: Category) => (
        <Space>
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, color: '#ffffff' }}>Categorías</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} disabled={!selectedLineId}>
          Nueva Categoría
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : categories.length > 0 ? (
        <Table columns={columns} dataSource={categories} rowKey="id" style={{ backgroundColor: '#1f2937' }} />
      ) : (
        <Empty description="No hay categorías" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title={editingId ? 'Editar Categoría' : 'Nueva Categoría'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'El nombre es requerido' }]}>
            <Input placeholder="Nombre de la categoría" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
