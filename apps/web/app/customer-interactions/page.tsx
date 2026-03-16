"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import type {
  CreateCustomerInteractionRequest,
  CustomerInteraction,
  CustomerProfile,
  UpdateCustomerInteractionRequest,
} from "@/lib/types";
import { InteractionChannel } from "@/lib/types";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Empty, Form, Input, Modal, Select, Space, Spin, Table } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

export default function CustomerInteractionsPage() {
  return (
    <LineProvider>
      <AppLayout>
        <CustomerInteractionsContent />
      </AppLayout>
    </LineProvider>
  );
}

function CustomerInteractionsContent() {
  const { message, modal } = App.useApp();
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  useEffect(() => {
    fetchInteractions();
    fetchProfiles();
  }, [pagination.page, pagination.limit]);

  const fetchInteractions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCustomerInteractions(pagination.page, pagination.limit);
      setInteractions(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar interacciones");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const response = await apiClient.getCustomerProfiles(1, 100);
      setProfiles(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: CustomerInteraction) => {
    setEditingId(record.id);
    form.setFieldsValue({
      profileId: record.profileId,
      channel: record.channel,
      date: record.date ? dayjs(record.date) : null,
      notes: record.notes,
      nextStep: record.nextStep,
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminacion",
      content: "Estas seguro de que deseas eliminar esta interaccion?",
      okText: "Si",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deleteCustomerInteraction(id);
          message.success("Interaccion eliminada");
          fetchInteractions();
        } catch (error) {
          message.error("Error al eliminar interaccion");
        }
      },
    });
  };

  const handleSubmit = async (values: {
    profileId: string;
    channel?: InteractionChannel;
    date?: dayjs.Dayjs;
    notes?: string;
    nextStep?: string;
  }) => {
    try {
      const data: CreateCustomerInteractionRequest = {
        profileId: values.profileId,
        channel: values.channel,
        date: values.date?.toISOString(),
        notes: values.notes,
        nextStep: values.nextStep,
      };

      if (editingId) {
        await apiClient.updateCustomerInteraction(editingId, data as UpdateCustomerInteractionRequest);
        message.success("Interacción actualizada");
      } else {
        await apiClient.createCustomerInteraction(data);
        message.success("Interacción creada");
      }
      setModalOpen(false);
      fetchInteractions();
    } catch (error) {
      message.error("Error al guardar interacción");
    }
  };

  const columns = [
    {
      title: "Cliente",
      dataIndex: ["profile", "customer", "name"],
      key: "customer",
      render: (text: string) => text || "-",
    },
    {
      title: "Medio",
      dataIndex: "channel",
      key: "channel",
      render: (text: string) => text || "-",
    },
    {
      title: "Notas",
      dataIndex: "notes",
      key: "notes",
      render: (text: string) => (text && text.length > 50 ? `${text.substring(0, 50)}...` : text || "-"),
    },
    {
      title: "Próximo paso",
      dataIndex: "nextStep",
      key: "nextStep",
      render: (text: string) => text || "-",
    },
    {
      title: "Fecha",
      dataIndex: "date",
      key: "date",
      render: (date: string) => (date ? new Date(date).toLocaleDateString("es-AR") : "-"),
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: any, record: CustomerInteraction) => (
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
        <h1 style={{ margin: 0, color: "#ffffff" }}>Interacciones con Clientes</h1>
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
        <Empty description="No hay interacciones" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title={editingId ? "Editar Interacción" : "Nueva Interacción"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="profileId"
            label="Perfil de Cliente"
            rules={[{ required: true, message: "El perfil es requerido" }]}
          >
            <Select
              placeholder="Selecciona un perfil"
              options={profiles.map((p) => ({
                label: p.customer?.name || "N/A",
                value: p.id,
              }))}
            />
          </Form.Item>

          <Form.Item name="channel" label="Medio de contacto">
            <Select
              placeholder="Seleccionar"
              options={[
                { value: InteractionChannel.CALL, label: "Llamada" },
                { value: InteractionChannel.EMAIL, label: "Email" },
                { value: InteractionChannel.WHATSAPP, label: "WhatsApp" },
                { value: InteractionChannel.MEETING, label: "Reunión" },
                { value: InteractionChannel.OTHER, label: "Otro" },
              ]}
              allowClear
            />
          </Form.Item>

          <Form.Item name="date" label="Fecha">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="notes" label="Resumen / Notas">
            <Input.TextArea placeholder="Notas de la interacción" rows={4} />
          </Form.Item>

          <Form.Item name="nextStep" label="Próximo paso">
            <Input placeholder="Próximo paso" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
