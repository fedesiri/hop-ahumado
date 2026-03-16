"use client";

import { apiClient } from "@/lib/api-client";
import type {
  Customer,
  CustomerInteraction,
  CustomerOpportunity,
  CustomerProfile,
  InteractionChannel,
  UpdateCustomerOpportunityRequest,
  UpdateCustomerProfileRequest,
  User,
} from "@/lib/types";
import { InteractionChannel as ChannelEnum } from "@/lib/types";
import { formatStatusLabel } from "@/lib/utils";
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, DatePicker, Descriptions, Form, Input, Modal, Select, Space, Spin, Tabs } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DetailData = CustomerProfile & {
  customer: Customer;
  responsible?: User | null;
  interactions: CustomerInteraction[];
  opportunity?: CustomerOpportunity | null;
  lastContactAt: string | null;
  daysSinceLastContact: number | null;
};

const CHANNEL_OPTIONS = [
  { value: ChannelEnum.CALL, label: "Llamada" },
  { value: ChannelEnum.EMAIL, label: "Email" },
  { value: ChannelEnum.WHATSAPP, label: "WhatsApp" },
  { value: ChannelEnum.MEETING, label: "Reunión" },
  { value: ChannelEnum.OTHER, label: "Otro" },
];

export default function CrmCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.profileId as string;
  const { message } = App.useApp();
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editOpportunityOpen, setEditOpportunityOpen] = useState(false);
  const [addInteractionOpen, setAddInteractionOpen] = useState(false);
  const [profileForm] = Form.useForm();
  const [opportunityForm] = Form.useForm();
  const [interactionForm] = Form.useForm();

  useEffect(() => {
    if (profileId) {
      fetchDetail();
      fetchUsers();
    }
  }, [profileId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCrmCustomerDetail(profileId);
      setDetail(data);
      profileForm.setFieldsValue({
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
        customerType: data.customerType,
        status: data.status,
        source: data.source,
        responsibleId: data.responsibleId,
        generalNotes: data.generalNotes,
        nextFollowUpAt: data.nextFollowUpAt ? dayjs(data.nextFollowUpAt) : null,
      });
      if (data.opportunity) {
        opportunityForm.setFieldsValue({
          stage: data.opportunity.stage,
          estimatedValue: data.opportunity.estimatedValue,
          expectedClosingDate: data.opportunity.expectedClosingDate
            ? dayjs(data.opportunity.expectedClosingDate)
            : null,
          notes: data.opportunity.notes,
        });
      } else {
        opportunityForm.resetFields();
      }
    } catch (error) {
      message.error("Error al cargar el cliente");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.getUsers(1, 200);
      setUsers(res.data);
    } catch {
      // ignore
    }
  };

  const handleUpdateProfile = async (
    values: UpdateCustomerProfileRequest & { nextFollowUpAt?: dayjs.Dayjs | null },
  ) => {
    try {
      await apiClient.updateCrmCustomerProfile(profileId, {
        ...values,
        nextFollowUpAt: values.nextFollowUpAt ? values.nextFollowUpAt.toISOString() : undefined,
      });
      message.success("Perfil actualizado");
      setEditProfileOpen(false);
      fetchDetail();
    } catch (error) {
      message.error("Error al actualizar");
      console.error(error);
    }
  };

  const handleUpsertOpportunity = async (
    values: UpdateCustomerOpportunityRequest & {
      expectedClosingDate?: dayjs.Dayjs | null;
      estimatedValue?: number | string;
    },
  ) => {
    try {
      const raw = values.estimatedValue;
      const estimatedValue =
        raw !== undefined && raw !== null && raw !== "" ? (typeof raw === "number" ? raw : Number(raw)) : undefined;
      const payload: UpdateCustomerOpportunityRequest = {
        stage: values.stage,
        notes: values.notes,
        expectedClosingDate: values.expectedClosingDate ? values.expectedClosingDate.toISOString() : undefined,
      };
      if (estimatedValue !== undefined && !Number.isNaN(estimatedValue)) {
        payload.estimatedValue = estimatedValue;
      }
      await apiClient.upsertCrmCustomerOpportunity(profileId, payload);
      message.success("Oportunidad guardada");
      setEditOpportunityOpen(false);
      fetchDetail();
    } catch (error) {
      message.error("Error al guardar oportunidad");
      console.error(error);
    }
  };

  const handleAddInteraction = async (values: {
    channel?: InteractionChannel;
    date?: dayjs.Dayjs;
    notes?: string;
    nextStep?: string;
  }) => {
    try {
      await apiClient.createCrmCustomerInteraction(profileId, {
        channel: values.channel,
        date: values.date ? values.date.toISOString() : undefined,
        notes: values.notes,
        nextStep: values.nextStep,
      });
      message.success("Interacción agregada");
      setAddInteractionOpen(false);
      interactionForm.resetFields();
      fetchDetail();
    } catch (error) {
      message.error("Error al agregar interacción");
      console.error(error);
    }
  };

  if (loading && !detail) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/crm">
          <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: "#9ca3af" }}>
            Volver al listado
          </Button>
        </Link>
      </div>

      <Card
        title={
          <span style={{ color: "#fafafa", fontSize: 18 }}>
            {detail.customer.name}
            {detail.contactName ? ` — ${detail.contactName}` : ""}
          </span>
        }
        extra={
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditProfileOpen(true)}>
            Editar perfil
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Nombre o razón social">{detail.customer.name}</Descriptions.Item>
          <Descriptions.Item label="Tipo de cliente">{detail.customerType ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Persona de contacto">{detail.contactName ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Teléfono">{detail.phone ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Email">{detail.email ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Estado del contacto">{formatStatusLabel(detail.status) || "—"}</Descriptions.Item>
          <Descriptions.Item label="¿De dónde nos conoció?">{detail.source ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Socio responsable del seguimiento">
            {detail.responsible?.name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Último contacto">
            {detail.lastContactAt ? new Date(detail.lastContactAt).toLocaleString("es-AR") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Días sin contacto">
            {detail.daysSinceLastContact != null ? detail.daysSinceLastContact : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Próximo seguimiento">
            {detail.nextFollowUpAt ? dayjs(detail.nextFollowUpAt).format("DD/MM/YYYY") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Notas generales">{detail.generalNotes ?? "—"}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs
        items={[
          {
            key: "interactions",
            label: "Interacciones",
            children: (
              <Card
                extra={
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setAddInteractionOpen(true)}
                  >
                    Nueva interacción
                  </Button>
                }
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  {detail.interactions.length === 0 ? (
                    <span style={{ color: "#9ca3af" }}>Sin interacciones</span>
                  ) : (
                    detail.interactions.map((i) => (
                      <Card key={i.id} size="small" type="inner">
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <span style={{ color: "#9ca3af" }}>
                            {new Date(i.date).toLocaleString("es-AR")} · {i.channel ?? "—"}
                          </span>
                        </div>
                        {i.notes && <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{i.notes}</p>}
                        {i.nextStep && (
                          <p style={{ margin: "4px 0 0", color: "#22c55e", fontSize: 12 }}>
                            Próximo paso: {i.nextStep}
                          </p>
                        )}
                      </Card>
                    ))
                  )}
                </Space>
              </Card>
            ),
          },
          {
            key: "opportunity",
            label: "Oportunidad",
            children: (
              <Card
                extra={
                  <Button
                    type="primary"
                    size="small"
                    icon={detail.opportunity ? <EditOutlined /> : <PlusOutlined />}
                    onClick={() => {
                      if (detail.opportunity) {
                        opportunityForm.setFieldsValue({
                          stage: detail.opportunity.stage,
                          estimatedValue: detail.opportunity.estimatedValue,
                          expectedClosingDate: detail.opportunity.expectedClosingDate
                            ? dayjs(detail.opportunity.expectedClosingDate)
                            : null,
                          notes: detail.opportunity.notes,
                        });
                      } else opportunityForm.resetFields();
                      setEditOpportunityOpen(true);
                    }}
                  >
                    {detail.opportunity ? "Editar" : "Crear"} oportunidad
                  </Button>
                }
              >
                {detail.opportunity ? (
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Etapa">{detail.opportunity.stage ?? "—"}</Descriptions.Item>
                    <Descriptions.Item label="Valor estimado">
                      {detail.opportunity.estimatedValue != null ? String(detail.opportunity.estimatedValue) : "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Fecha cierre estimada">
                      {detail.opportunity.expectedClosingDate
                        ? dayjs(detail.opportunity.expectedClosingDate).format("DD/MM/YYYY")
                        : "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Notas">{detail.opportunity.notes ?? "—"}</Descriptions.Item>
                  </Descriptions>
                ) : (
                  <span style={{ color: "#9ca3af" }}>Sin oportunidad cargada</span>
                )}
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Editar perfil"
        open={editProfileOpen}
        onCancel={() => setEditProfileOpen(false)}
        onOk={() => profileForm.submit()}
        okText="Guardar"
        width={500}
        forceRender
      >
        <Form form={profileForm} layout="vertical" onFinish={handleUpdateProfile}>
          <Form.Item name="contactName" label="Persona de contacto (opcional)">
            <Input placeholder="En empresas: quién atiende" />
          </Form.Item>
          <Form.Item name="phone" label="Teléfono">
            <Input placeholder="Teléfono de contacto" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="Email de contacto" />
          </Form.Item>
          <Form.Item name="customerType" label="Tipo de cliente">
            <Select
              allowClear
              options={[
                { value: "Empresa", label: "Empresa" },
                { value: "Particular", label: "Particular" },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="Estado del contacto">
            <Input placeholder="Ej: Prospecto, Cliente, Inactivo" />
          </Form.Item>
          <Form.Item name="source" label="¿De dónde nos conoció? (origen del cliente)">
            <Input placeholder="Ej: Web, Referido, Evento, Redes sociales" />
          </Form.Item>
          <Form.Item
            name="responsibleId"
            label="Socio responsable del seguimiento (opcional)"
            extra="Quién lleva o consiguió este cliente. Puede quedar sin asignar."
          >
            <Select allowClear placeholder="Ninguno" options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="generalNotes" label="Notas generales">
            <Input.TextArea rows={2} placeholder="Anotaciones sobre el cliente" />
          </Form.Item>
          <Form.Item name="nextFollowUpAt" label="Fecha del próximo seguimiento">
            <DatePicker style={{ width: "100%" }} placeholder="Cuándo volver a contactar" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detail.opportunity ? "Editar oportunidad" : "Crear oportunidad"}
        open={editOpportunityOpen}
        onCancel={() => setEditOpportunityOpen(false)}
        onOk={() => opportunityForm.submit()}
        okText="Guardar"
        width={500}
        forceRender
      >
        <Form form={opportunityForm} layout="vertical" onFinish={handleUpsertOpportunity}>
          <Form.Item name="stage" label="Etapa">
            <Input />
          </Form.Item>
          <Form.Item name="estimatedValue" label="Valor estimado">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="expectedClosingDate" label="Fecha cierre estimada">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="notes" label="Notas">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Nueva interacción"
        open={addInteractionOpen}
        onCancel={() => setAddInteractionOpen(false)}
        onOk={() => interactionForm.submit()}
        okText="Agregar"
        width={500}
        forceRender
      >
        <Form
          form={interactionForm}
          layout="vertical"
          onFinish={handleAddInteraction}
          initialValues={{ date: dayjs() }}
        >
          <Form.Item name="channel" label="Medio de contacto">
            <Select options={CHANNEL_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="date" label="Fecha">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="notes" label="Resumen / Notas">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="nextStep" label="Próximo paso">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
