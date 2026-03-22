"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import type { Dayjs } from "@/lib/dayjs";
import dayjs from "@/lib/dayjs";
import { LineProvider } from "@/lib/line-context";
import type {
  CreateCustomerProfileRequest,
  Customer,
  CustomerProfile,
  UpdateCustomerProfileRequest,
  User,
} from "@/lib/types";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Empty, Form, Input, Modal, Select, Space, Spin, Table } from "antd";
import { useEffect, useState } from "react";

export default function CustomerProfilesPage() {
  return (
    <LineProvider>
      <AppLayout>
        <CustomerProfilesContent />
      </AppLayout>
    </LineProvider>
  );
}

function CustomerProfilesContent() {
  const { message, modal } = App.useApp();
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  useEffect(() => {
    fetchProfiles();
    fetchCustomers();
    fetchUsers();
  }, [pagination.page, pagination.limit]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCustomerProfiles(pagination.page, pagination.limit);
      setProfiles(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar perfiles");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await apiClient.getCustomers(1, 100);
      setCustomers(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiClient.getUsers(1, 100);
      setUsers(response.data);
    } catch (error) {
      message.error("Error al cargar usuarios para responsables");
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: CustomerProfile) => {
    setEditingId(record.id);
    form.setFieldsValue({
      customerId: record.customerId,
      contactName: record.contactName,
      phone: record.phone,
      email: record.email,
      customerType: record.customerType,
      status: record.status,
      source: record.source,
      responsibleId: record.responsibleId,
      generalNotes: record.generalNotes,
      nextFollowUpAt: record.nextFollowUpAt ? dayjs(record.nextFollowUpAt) : null,
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminacion",
      content: "Estas seguro de que deseas eliminar este perfil?",
      okText: "Si",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deleteCustomerProfile(id);
          message.success("Perfil eliminado");
          fetchProfiles();
        } catch (error) {
          message.error("Error al eliminar perfil");
        }
      },
    });
  };

  const handleSubmit = async (values: {
    customerId: string;
    contactName?: string;
    phone?: string;
    email?: string;
    customerType?: string;
    status?: string;
    source?: string;
    responsibleId?: string;
    generalNotes?: string;
    nextFollowUpAt?: Dayjs;
  }) => {
    try {
      const data: CreateCustomerProfileRequest = {
        customerId: values.customerId,
        contactName: values.contactName,
        phone: values.phone,
        email: values.email,
        customerType: values.customerType,
        status: values.status,
        source: values.source,
        responsibleId: values.responsibleId,
        generalNotes: values.generalNotes,
        nextFollowUpAt: values.nextFollowUpAt?.toISOString(),
      };

      if (editingId) {
        await apiClient.updateCustomerProfile(editingId, data as UpdateCustomerProfileRequest);
        message.success("Perfil actualizado");
      } else {
        await apiClient.createCustomerProfile(data);
        message.success("Perfil creado");
      }
      setModalOpen(false);
      fetchProfiles();
    } catch (error) {
      message.error("Error al guardar perfil");
    }
  };

  const columns = [
    {
      title: "Cliente",
      dataIndex: ["customer", "name"],
      key: "customer",
      render: (text: string) => text || "-",
    },
    {
      title: "Contacto",
      dataIndex: "contactName",
      key: "contactName",
      render: (text: string) => text || "-",
    },
    {
      title: "Tipo",
      dataIndex: "customerType",
      key: "customerType",
      render: (text: string) => text || "-",
    },
    {
      title: "Estado",
      dataIndex: "status",
      key: "status",
      render: (text: string) => text || "-",
    },
    {
      title: "Responsable",
      dataIndex: ["responsible", "name"],
      key: "responsible",
      render: (text: string) => text || "-",
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: any, record: CustomerProfile) => (
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
        <h1 style={{ margin: 0, color: "#ffffff" }}>Perfiles de Clientes</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo Perfil
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : profiles.length > 0 ? (
        <Table
          columns={columns}
          dataSource={profiles}
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
        <Empty description="No hay perfiles" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title={editingId ? "Editar Perfil" : "Nuevo Perfil"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="customerId" label="Cliente" rules={[{ required: true, message: "El cliente es requerido" }]}>
            <Select
              placeholder="Selecciona un cliente"
              options={customers.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>

          <Form.Item name="contactName" label="Nombre del contacto">
            <Input placeholder="Persona de contacto" />
          </Form.Item>

          <Form.Item name="phone" label="Teléfono">
            <Input placeholder="Teléfono" />
          </Form.Item>

          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="Email" />
          </Form.Item>

          <Form.Item name="customerType" label="Tipo de Cliente">
            <Input placeholder="Tipo de cliente" />
          </Form.Item>

          <Form.Item name="status" label="Estado">
            <Input placeholder="Estado" />
          </Form.Item>

          <Form.Item name="source" label="Fuente">
            <Input placeholder="Fuente del cliente" />
          </Form.Item>

          <Form.Item name="responsibleId" label="Responsable">
            <Select
              placeholder="Selecciona un responsable"
              options={users.map((u) => ({ label: u.name, value: u.id }))}
            />
          </Form.Item>

          <Form.Item name="generalNotes" label="Notas generales">
            <Input.TextArea rows={2} placeholder="Notas" />
          </Form.Item>

          <Form.Item name="nextFollowUpAt" label="Próximo seguimiento">
            <DatePicker style={{ width: "100%" }} placeholder="Próximo seguimiento" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
