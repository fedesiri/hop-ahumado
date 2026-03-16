"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import type { CreateCustomerRequest, Customer, PaginationMeta, UpdateCustomerRequest } from "@/lib/types";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Empty, Form, Input, Modal, Space, Spin, Table } from "antd";
import { useEffect, useState } from "react";

export default function CustomersPage() {
  return (
    <LineProvider>
      <AppLayout>
        <CustomersContent />
      </AppLayout>
    </LineProvider>
  );
}

function CustomersContent() {
  const { message, modal } = App.useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, [pagination.page, pagination.limit]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCustomers(pagination.page, pagination.limit);
      setCustomers(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar clientes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Customer) => {
    setEditingId(record.id);
    form.setFieldsValue({ name: record.name });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminacion",
      content: "Estas seguro de que deseas eliminar este cliente?",
      okText: "Si",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deleteCustomer(id);
          message.success("Cliente eliminado");
          fetchCustomers();
        } catch (error) {
          message.error("Error al eliminar cliente");
        }
      },
    });
  };

  const handleSubmit = async (values: { name: string }) => {
    try {
      const data: CreateCustomerRequest = { name: values.name };
      if (editingId) {
        await apiClient.updateCustomer(editingId, data as UpdateCustomerRequest);
        message.success("Cliente actualizado");
      } else {
        await apiClient.createCustomer(data);
        message.success("Cliente creado");
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (error) {
      message.error("Error al guardar cliente");
    }
  };

  const columns = [
    {
      title: "Empresa",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Fecha de Creación",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR"),
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: any, record: Customer) => (
        <Space>
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, color: "#ffffff" }}>Clientes</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo Cliente
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : customers.length > 0 ? (
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="id"
          style={{ backgroundColor: "#1f2937" }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: meta?.total || 0,
            onChange: (page, pageSize) => {
              setPagination({ page, limit: pageSize });
            },
          }}
        />
      ) : (
        <Empty description="No hay clientes" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title={editingId ? "Editar Cliente" : "Nuevo Cliente"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Empresa" rules={[{ required: true, message: "El nombre es requerido" }]}>
            <Input placeholder="Nombre de la empresa" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
