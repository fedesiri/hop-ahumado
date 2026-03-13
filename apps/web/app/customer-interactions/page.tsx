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
  App,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { AppLayout } from '@/components/app-layout'
import { LineProvider } from '@/lib/line-context'
import { apiClient } from '@/lib/api-client'
import type { CustomerInteraction, CustomerProfile, CreateCustomerInteractionRequest, UpdateCustomerInteractionRequest } from '@/lib/types'

export default function CustomerInteractionsPage() {
  return (
    <LineProvider>
      <AppLayout>
        <CustomerInteractionsContent />
      </AppLayout>
    </LineProvider>
  )
}

function CustomerInteractionsContent() {
  const { message, modal } = App.useApp()
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([])
  const [profiles, setProfiles] = useState<CustomerProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ page: 1, limit: 10 })
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null)

  useEffect(() => {
    fetchInteractions()
    fetchProfiles()
  }, [pagination.page, pagination.limit])

  const fetchInteractions = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getCustomerInteractions(
        pagination.page,
        pagination.limit
      )
      setInteractions(response.data)
      setMeta(response.meta)
    } catch (error) {
      message.error('Error al cargar interacciones')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfiles = async () => {
    try {
      const response = await apiClient.getCustomerProfiles(1, 100)
      setProfiles(response.data)
    } catch (error) {
      console.error(error)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: CustomerInteraction) => {
    setEditingId(record.id)
    form.setFieldsValue({
      profileId: record.profileId,
      type: record.type,
      note: record.note,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Confirmar eliminacion',
      content: 'Estas seguro de que deseas eliminar esta interaccion?',
      okText: 'Si',
      cancelText: 'No',
      onOk: async () => {
        try {
          await apiClient.deleteCustomerInteraction(id)
          message.success('Interaccion eliminada')
          fetchInteractions()
        } catch (error) {
          message.error('Error al eliminar interaccion')
        }
      },
    })
  }

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateCustomerInteractionRequest = {
        profileId: values.profileId,
        type: values.type,
        note: values.note,
      }

      if (editingId) {
        await apiClient.updateCustomerInteraction(editingId, data as UpdateCustomerInteractionRequest)
        message.success('Interacción actualizada')
      } else {
        await apiClient.createCustomerInteraction(data)
        message.success('Interacción creada')
      }
      setModalOpen(false)
      fetchInteractions()
    } catch (error) {
      message.error('Error al guardar interacción')
    }
  }

  const columns = [
    {
      title: 'Cliente',
      dataIndex: ['profile', 'customer', 'name'],
      key: 'customer',
      render: (text: string) => text || '-',
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => text || '-',
    },
    {
      title: 'Nota',
      dataIndex: 'note',
      key: 'note',
      render: (text: string) => (text && text.length > 50) ? `${text.substring(0, 50)}...` : text || '-',
    },
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('es-AR'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_: any, record: CustomerInteraction) => (
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
        <h1 style={{ margin: 0, color: '#ffffff' }}>Interacciones con Clientes</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nueva Interacción
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : interactions.length > 0 ? (
        <Table
          columns={columns}
          dataSource={interactions}
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
        <Empty description="No hay interacciones" style={{ color: '#9ca3af' }} />
      )}

      <Modal
        title={editingId ? 'Editar Interacción' : 'Nueva Interacción'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="profileId"
            label="Perfil de Cliente"
            rules={[{ required: true, message: 'El perfil es requerido' }]}
          >
            <Select
              placeholder="Selecciona un perfil"
              options={profiles.map((p) => ({
                label: p.customer?.name || 'N/A',
                value: p.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="type"
            label="Tipo de Interacción"
          >
            <Input placeholder="Tipo (ej. llamada, email, reunión)" />
          </Form.Item>

          <Form.Item
            name="note"
            label="Nota"
          >
            <Input.TextArea
              placeholder="Nota de la interacción"
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
