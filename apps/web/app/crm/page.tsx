"use client";

import { apiClient } from "@/lib/api-client";
import {
  CRM_CUSTOMER_TYPE_OPTIONS,
  CRM_SOURCE_OPTIONS,
  CRM_STATUS_OPTIONS,
  mergeCrmSelectOptions,
  normalizeCrmStatusForForm,
} from "@/lib/crm-profile-options";
import type { Dayjs } from "@/lib/dayjs";
import dayjs from "@/lib/dayjs";
import type { CreateCrmCustomerRequest, CrmCustomerListItem, PaginationMeta, User } from "@/lib/types";
import { formatStatusLabel } from "@/lib/utils";
import { EditOutlined, EyeOutlined, FormOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Empty, Form, Input, Modal, Select, Space, Spin, Table, Tag, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string | undefined>(undefined);
  const [responsibleIdFilter, setResponsibleIdFilter] = useState<string | undefined>(undefined);

  /** false = abrir en modo crear (reset); objeto = valores al editar. Se aplica en afterOpenChange cuando el Form ya está montado. */
  const pendingModalFormRef = useRef<Record<string, unknown> | false | null>(null);

  const getStatusColor = (status: string | null) => {
    if (!status) return "default";
    const normalized = formatStatusLabel(status).toLowerCase();
    if (normalized === "lead") return "geekblue";
    if (normalized === "prospecto") return "blue";
    if (normalized === "cliente") return "green";
    if (normalized === "pausado") return "orange";
    if (normalized === "perdido") return "red";
    return "default";
  };

  const statusFormOptions = useMemo(
    () =>
      mergeCrmSelectOptions(
        editingRecord
          ? (normalizeCrmStatusForForm(editingRecord.status) ?? editingRecord.status ?? undefined)
          : undefined,
        CRM_STATUS_OPTIONS,
      ),
    [editingRecord, modalOpen],
  );
  const customerTypeFormOptions = useMemo(
    () => mergeCrmSelectOptions(editingRecord?.customerType ?? undefined, CRM_CUSTOMER_TYPE_OPTIONS),
    [editingRecord, modalOpen],
  );
  const sourceFormOptions = useMemo(
    () => mergeCrmSelectOptions(editingRecord?.source ?? undefined, CRM_SOURCE_OPTIONS),
    [editingRecord, modalOpen],
  );

  useEffect(() => {
    fetchList();
    fetchUsers();
  }, [pagination.page, pagination.limit, search, statusFilter, sourceFilter, customerTypeFilter, responsibleIdFilter]);

  const fetchList = async () => {
    try {
      setLoading(true);
      const response = await apiClient.listCrmCustomers(
        pagination.page,
        pagination.limit,
        search,
        statusFilter,
        sourceFilter,
        customerTypeFilter,
        responsibleIdFilter,
      );
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
      const response = await apiClient.getUsers(1, 100);
      setUsers(response.data);
    } catch (error) {
      message.error("Error al cargar usuarios para responsables");
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    pendingModalFormRef.current = false;
    setModalOpen(true);
  };

  const handleEdit = async (record: CrmCustomerListItem) => {
    setEditingRecord(record);
    if (record.profileId) {
      try {
        setLoadingDetail(true);
        const detail = await apiClient.getCrmCustomerDetail(record.profileId);
        pendingModalFormRef.current = {
          name: detail.customer.name,
          customerType: detail.customerType,
          contactName: detail.contactName,
          phone: detail.phone,
          email: detail.email,
          status: normalizeCrmStatusForForm(detail.status) ?? detail.status ?? undefined,
          source: detail.source,
          responsibleId: detail.responsibleId,
          generalNotes: detail.generalNotes,
          nextFollowUpAt: detail.nextFollowUpAt ? dayjs(detail.nextFollowUpAt) : null,
        };
      } catch (error) {
        message.error("Error al cargar el cliente");
        setEditingRecord(null);
        pendingModalFormRef.current = null;
        return;
      } finally {
        setLoadingDetail(false);
      }
    } else {
      pendingModalFormRef.current = {
        name: record.customerName,
        customerType: record.customerType,
        contactName: record.contactName,
        phone: record.phone,
        email: record.email,
        status: normalizeCrmStatusForForm(record.status) ?? record.status ?? undefined,
        source: record.source,
        responsibleId: record.responsibleId,
        generalNotes: null,
        nextFollowUpAt: null,
      };
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

  const handleSubmit = async (values: CreateCrmCustomerRequest & { nextFollowUpAt?: Dayjs | null }) => {
    try {
      const normalizedEmail = values.email?.trim();
      const profilePayload = {
        contactName: values.contactName,
        phone: values.phone,
        email: normalizedEmail || undefined,
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
    {
      title: "Estado del contacto",
      dataIndex: "status",
      key: "status",
      render: (v: string | null) => {
        const label = formatStatusLabel(v);
        if (!label) return "—";
        return <Tag color={getStatusColor(v)}>{label}</Tag>;
      },
    },
    { title: "Origen (cómo nos conoció)", dataIndex: "source", key: "source" },
    { title: "Socio responsable", dataIndex: "responsibleName", key: "responsibleName" },
    {
      title: (
        <Tooltip title="La fecha más reciente entre la última entrega registrada en pedidos y el último seguimiento CRM.">
          <span style={{ cursor: "help", borderBottom: "1px dotted rgba(250,250,250,0.35)" }}>Último vínculo</span>
        </Tooltip>
      ),
      dataIndex: "lastContactAt",
      key: "lastContactAt",
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString("es-AR") : "—"),
    },
    {
      title: (
        <Tooltip title="Días desde el último vínculo (pedido o seguimiento).">
          <span style={{ cursor: "help", borderBottom: "1px dotted rgba(250,250,250,0.35)" }}>Días sin vínculo</span>
        </Tooltip>
      ),
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
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: unknown, record: CrmCustomerListItem) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            title="Editar"
            aria-label="Editar"
            onClick={() => handleEdit(record)}
            loading={loadingDetail && editingRecord?.customerId === record.customerId}
          />
          <Button
            type="default"
            size="small"
            icon={record.profileId ? <EyeOutlined /> : <FormOutlined />}
            title={record.profileId ? "Ver cliente" : "Completar perfil"}
            aria-label={record.profileId ? "Ver cliente" : "Completar perfil"}
            onClick={() => goToCustomer(record)}
            loading={creatingProfileForId === record.customerId}
          />
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

      <div style={{ marginBottom: 16 }}>
        <Space wrap align="start">
          <Input
            allowClear
            placeholder="Buscar: nombre, contacto, email, teléfono…"
            style={{ minWidth: 220 }}
            value={search ?? ""}
            onChange={(e) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              const v = e.target.value;
              setSearch(v === "" ? undefined : v);
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tipo de cliente"
            style={{ minWidth: 200 }}
            value={customerTypeFilter}
            options={[...CRM_CUSTOMER_TYPE_OPTIONS]}
            onChange={(v) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setCustomerTypeFilter(v);
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Estado del contacto"
            style={{ minWidth: 200 }}
            value={statusFilter}
            options={[...CRM_STATUS_OPTIONS]}
            onChange={(v) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setStatusFilter(v);
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Origen"
            style={{ minWidth: 200 }}
            value={sourceFilter}
            options={[...CRM_SOURCE_OPTIONS]}
            onChange={(v) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setSourceFilter(v);
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Socio responsable"
            style={{ minWidth: 220 }}
            value={responsibleIdFilter}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            onChange={(v) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setResponsibleIdFilter(v);
            }}
          />
        </Space>
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
        destroyOnClose
        onCancel={() => {
          setModalOpen(false);
          setEditingRecord(null);
          pendingModalFormRef.current = null;
        }}
        afterOpenChange={(open) => {
          if (!open) return;
          const pending = pendingModalFormRef.current;
          if (pending === false) {
            form.resetFields();
            form.setFieldsValue({ customerType: "Empresa" });
            pendingModalFormRef.current = null;
          } else if (pending && typeof pending === "object") {
            form.setFieldsValue(pending);
            pendingModalFormRef.current = null;
          }
        }}
        onOk={() => form.submit()}
        okText={editingRecord ? "Guardar" : "Crear"}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="customerType" label="Tipo de cliente" initialValue={editingRecord ? undefined : "Empresa"}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Empresa o particular"
              options={customerTypeFormOptions}
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
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Seleccioná un estado"
              options={statusFormOptions}
            />
          </Form.Item>
          <Form.Item name="source" label="¿De dónde nos conoció? (origen del cliente)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Elegí un origen"
              options={sourceFormOptions}
            />
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
