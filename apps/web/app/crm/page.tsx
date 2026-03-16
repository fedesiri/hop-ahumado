"use client";

import { apiClient } from "@/lib/api-client";
import type { CreateCrmCustomerRequest, CrmCustomerListItem, PaginationMeta, User } from "@/lib/types";
import { EditOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Empty, Form, Input, Modal, Select, Space, Spin, Table } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CrmPage() {
  return <CrmContent />;
}

function CrmContent() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [list, setList] = useState<CrmCustomerListItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [creatingProfileForId, setCreatingProfileForId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<CrmCustomerListItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchList();
    fetchUsers();
  }, [pagination.page, pagination.limit]);

  const fetchList = async () => {
    try {
      setLoading(true);
      const response = await apiClient.listCrmCustomers(pagination.page, pagination.limit);
      setList(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar clientes CRM");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiClient.getUsers(1, 200);
      setUsers(response.data);
    } catch {
      // ignore
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = async (record: CrmCustomerListItem) => {
    setEditingRecord(record);
    if (record.profileId) {
      try {
        setLoadingDetail(true);
        const detail = await apiClient.getCrmCustomerDetail(record.profileId);
        form.setFieldsValue({
          name: detail.customer.name,
          customerType: detail.customerType,
          contactName: detail.contactName,
          phone: detail.phone,
          email: detail.email,
          status: detail.status,
          source: detail.source,
          responsibleId: detail.responsibleId,
          generalNotes: detail.generalNotes,
          nextFollowUpAt: detail.nextFollowUpAt ? dayjs(detail.nextFollowUpAt) : null,
        });
      } catch (error) {
        message.error("Error al cargar el cliente");
        setEditingRecord(null);
        return;
      } finally {
        setLoadingDetail(false);
      }
    } else {
      form.setFieldsValue({
        name: record.customerName,
        customerType: record.customerType,
        contactName: record.contactName,
        phone: record.phone,
        email: record.email,
        status: record.status,
        source: record.source,
        responsibleId: record.responsibleId,
        generalNotes: null,
        nextFollowUpAt: null,
      });
    }
    setModalOpen(true);
  };

  const goToCustomer = async (record: CrmCustomerListItem) => {
    if (record.profileId) {
      router.push(`/crm/customers/${record.profileId}`);
      return;
    }
    try {
      setCreatingProfileForId(record.customerId);
      const profile = await apiClient.createCustomerProfile({ customerId: record.customerId });
      message.success("Perfil CRM creado");
      fetchList();
      router.push(`/crm/customers/${profile.id}`);
    } catch (error) {
      message.error("Error al crear perfil");
      console.error(error);
    } finally {
      setCreatingProfileForId(null);
    }
  };

  const handleSubmit = async (values: CreateCrmCustomerRequest & { nextFollowUpAt?: dayjs.Dayjs | null }) => {
    try {
      const profilePayload = {
        contactName: values.contactName,
        phone: values.phone,
        email: values.email,
        customerType: values.customerType,
        status: values.status,
        source: values.source,
        responsibleId: values.responsibleId,
        generalNotes: values.generalNotes,
        nextFollowUpAt: values.nextFollowUpAt ? values.nextFollowUpAt.toISOString() : undefined,
      };
      if (editingRecord) {
        await apiClient.updateCustomer(editingRecord.customerId, { name: values.name });
        if (editingRecord.profileId) {
          await apiClient.updateCrmCustomerProfile(editingRecord.profileId, profilePayload);
        } else {
          await apiClient.createCustomerProfile({
            customerId: editingRecord.customerId,
            ...profilePayload,
          });
        }
        message.success("Cliente actualizado");
        setEditingRecord(null);
      } else {
        await apiClient.createCrmCustomer({
          name: values.name,
          ...profilePayload,
        });
        message.success("Cliente creado");
      }
      setModalOpen(false);
      fetchList();
    } catch (error) {
      message.error(editingRecord ? "Error al actualizar cliente" : "Error al crear cliente");
      console.error(error);
    }
  };

  const columns = [
    {
      title: "Nombre / Razón social",
      dataIndex: "customerName",
      key: "customerName",
      render: (name: string, record: CrmCustomerListItem) => (
        <Button
          type="link"
          onClick={() => goToCustomer(record)}
          loading={creatingProfileForId === record.customerId}
          style={{ color: "#22c55e", fontWeight: 500, padding: 0 }}
        >
          {name}
        </Button>
      ),
    },
    { title: "Estado del contacto", dataIndex: "status", key: "status" },
    { title: "Origen (cómo nos conoció)", dataIndex: "source", key: "source" },
    { title: "Socio responsable", dataIndex: "responsibleName", key: "responsibleName" },
    {
      title: "Último contacto",
      dataIndex: "lastContactAt",
      key: "lastContactAt",
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString("es-AR") : "—"),
    },
    {
      title: "Días sin contacto",
      dataIndex: "daysSinceLastContact",
      key: "daysSinceLastContact",
      render: (v: number | null) =>
        v != null ? <span style={{ color: v > 30 ? "#f59e0b" : undefined }}>{v}</span> : "—",
    },
    {
      title: "Próximo seguimiento",
      dataIndex: "nextFollowUpAt",
      key: "nextFollowUpAt",
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString("es-AR") : "—"),
    },
    {
      title: "",
      key: "actions",
      render: (_: unknown, record: CrmCustomerListItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            loading={loadingDetail && editingRecord?.customerId === record.customerId}
          >
            Editar
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => goToCustomer(record)}
            loading={creatingProfileForId === record.customerId}
          >
            {record.profileId ? "Ver" : "Completar perfil"}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, color: "#fafafa", fontSize: 24 }}>CRM - Clientes</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo cliente
        </Button>
      </div>

      <Spin spinning={loading}>
        {list.length === 0 && !loading ? (
          <Empty description="No hay clientes" />
        ) : (
          <Table
            rowKey="customerId"
            dataSource={list}
            columns={columns}
            pagination={
              meta
                ? {
                    current: meta.page,
                    pageSize: meta.limit,
                    total: meta.total,
                    showSizeChanger: true,
                    onChange: (page, pageSize) => setPagination({ page, limit: pageSize || 10 }),
                  }
                : false
            }
            size="small"
          />
        )}
      </Spin>

      <Modal
        title={editingRecord ? "Editar cliente" : "Nuevo cliente"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRecord(null);
        }}
        onOk={() => form.submit()}
        okText={editingRecord ? "Guardar" : "Crear"}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="customerType" label="Tipo de cliente" initialValue={editingRecord ? undefined : "Empresa"}>
            <Select
              options={[
                { value: "Empresa", label: "Empresa" },
                { value: "Particular", label: "Particular" },
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="Nombre o razón social" rules={[{ required: true, message: "Requerido" }]}>
            <Input placeholder="Empresa: razón social. Particular: nombre y apellido" />
          </Form.Item>
          <Form.Item name="contactName" label="Persona de contacto (opcional)">
            <Input placeholder="En empresas: quién atiende. En particulares: puede quedar vacío" />
          </Form.Item>
          <Form.Item name="phone" label="Teléfono">
            <Input placeholder="Teléfono de contacto" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="Email de contacto" />
          </Form.Item>
          <Form.Item name="status" label="Estado del contacto">
            <Input placeholder="Ej: Prospecto, Cliente, Inactivo" />
          </Form.Item>
          <Form.Item name="source" label="¿De dónde nos conoció? (origen del cliente)">
            <Input placeholder="Ej: Web, Referido, Evento, Redes sociales, Google" />
          </Form.Item>
          <Form.Item
            name="responsibleId"
            label="Socio responsable del seguimiento (opcional)"
            extra="Quién lleva o consiguió este cliente. Si ya es cliente fijo puede quedar sin asignar."
          >
            <Select allowClear placeholder="Ninguno" options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="generalNotes" label="Notas generales">
            <Input.TextArea rows={2} placeholder="Anotaciones sobre el cliente" />
          </Form.Item>
          <Form.Item name="nextFollowUpAt" label="Fecha del próximo seguimiento">
            <DatePicker style={{ width: "100%" }} showTime={false} placeholder="Cuándo volver a contactar" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
