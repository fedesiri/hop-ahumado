"use client";

import { OrderDetailView } from "@/components/orders/order-detail-view";
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
import { formatCurrency } from "@/lib/format-currency";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { formatPaymentMethodsOnly, orderPaymentStatusLabel } from "@/lib/order-labels";
import type {
  Customer,
  CustomerInteraction,
  CustomerOpportunity,
  CustomerProfile,
  InteractionChannel,
  Order,
  OrderItem,
  OrderPaymentStatus,
  UpdateCustomerOpportunityRequest,
  UpdateCustomerProfileRequest,
  User,
} from "@/lib/types";
import { InteractionChannel as ChannelEnum } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { formatStatusLabel } from "@/lib/utils";
import { ArrowLeftOutlined, EditOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DetailData = CustomerProfile & {
  customer: Customer;
  responsible?: User | null;
  interactions: CustomerInteraction[];
  opportunity?: CustomerOpportunity | null;
  lastContactAt: string | null;
  lastOrderDeliveryAt: string | null;
  lastInteractionAt: string | null;
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
  const profileId = params.profileId as string;
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { message } = App.useApp();
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editOpportunityOpen, setEditOpportunityOpen] = useState(false);
  const [addInteractionOpen, setAddInteractionOpen] = useState(false);
  const [viewOrderOpen, setViewOrderOpen] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalOrderLoading, setModalOrderLoading] = useState(false);
  const [compareMonthA, setCompareMonthA] = useState<string | undefined>(undefined);
  const [compareMonthB, setCompareMonthB] = useState<string | undefined>(undefined);
  const [kpiScope, setKpiScope] = useState<"all" | "monthA" | "monthB" | "customRange">("all");
  const [kpiCustomRange, setKpiCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [profileForm] = Form.useForm();
  const [opportunityForm] = Form.useForm();
  const [interactionForm] = Form.useForm();

  const profileStatusOptions = useMemo(
    () =>
      mergeCrmSelectOptions(
        detail ? (normalizeCrmStatusForForm(detail.status) ?? detail.status ?? undefined) : undefined,
        CRM_STATUS_OPTIONS,
      ),
    [detail?.status, editProfileOpen],
  );
  const profileCustomerTypeOptions = useMemo(
    () => mergeCrmSelectOptions(detail?.customerType ?? undefined, CRM_CUSTOMER_TYPE_OPTIONS),
    [detail?.customerType, editProfileOpen],
  );
  const profileSourceOptions = useMemo(
    () => mergeCrmSelectOptions(detail?.source ?? undefined, CRM_SOURCE_OPTIONS),
    [detail?.source, editProfileOpen],
  );

  useEffect(() => {
    if (profileId) {
      fetchDetail();
      fetchUsers();
    }
  }, [profileId]);

  useEffect(() => {
    if (detail?.customer?.id) {
      fetchOrders(detail.customer.id);
    }
  }, [detail?.customer?.id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCrmCustomerDetail(profileId);
      setDetail(data);
    } catch (error) {
      message.error("Error al cargar el cliente");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.getUsers(1, 100);
      setUsers(res.data);
    } catch (error) {
      message.error("Error al cargar usuarios para el responsable");
      console.error(error);
    }
  };

  const fetchOrders = async (customerId: string) => {
    try {
      setOrdersLoading(true);
      const response = await apiClient.getOrders(1, 100, customerId);
      setOrders(response.data);
    } catch (error) {
      message.error("Error al cargar pedidos del cliente");
      console.error(error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const openOrderDetail = async (orderId: string) => {
    setViewOrderOpen(true);
    setModalOrder(null);
    setModalOrderLoading(true);
    try {
      const detailOrder = await apiClient.getOrder(orderId);
      setModalOrder(detailOrder);
    } catch (error) {
      message.error("No se pudo cargar el detalle del pedido");
      console.error(error);
      setViewOrderOpen(false);
    } finally {
      setModalOrderLoading(false);
    }
  };

  const handleUpdateProfile = async (values: UpdateCustomerProfileRequest & { nextFollowUpAt?: Dayjs | null }) => {
    try {
      const normalizedEmail = values.email?.trim();
      await apiClient.updateCrmCustomerProfile(profileId, {
        ...values,
        email: normalizedEmail || undefined,
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
      expectedClosingDate?: Dayjs | null;
      estimatedValue?: number | string;
    },
  ) => {
    try {
      const raw = values.estimatedValue;
      const estimatedValue =
        raw === undefined || raw === null
          ? undefined
          : typeof raw === "number"
            ? raw
            : raw === ""
              ? undefined
              : Number(raw);
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
    date?: Dayjs;
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
      message.success("Seguimiento registrado");
      setAddInteractionOpen(false);
      interactionForm.resetFields();
      fetchDetail();
    } catch (error) {
      message.error("Error al registrar seguimiento");
      console.error(error);
    }
  };

  const monthlyOrdersSeries = useMemo(() => {
    const map = new Map<string, { month: string; monthSort: string; count: number }>();
    for (const order of orders) {
      const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
      const parsedDate = dayjs(rawDate);
      if (!parsedDate.isValid()) continue;
      const monthSort = parsedDate.format("YYYY-MM");
      const month = parsedDate.format("MM/YYYY");
      const current = map.get(monthSort) ?? { month, monthSort, count: 0 };
      current.count += 1;
      map.set(monthSort, current);
    }
    return Array.from(map.values())
      .sort((a, b) => a.monthSort.localeCompare(b.monthSort))
      .slice(-12);
  }, [orders]);

  const itemBreakdown = useMemo(() => {
    const byItem = new Map<string, number>();
    for (const order of orders) {
      for (const item of (order.orderItems ?? []) as OrderItem[]) {
        const itemName = item.product?.name ?? "Ítem sin nombre";
        byItem.set(itemName, (byItem.get(itemName) ?? 0) + Number(item.quantity ?? 0));
      }
    }
    return Array.from(byItem.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  const scopedOrders = useMemo(() => {
    const matchesMonth = (order: Order, monthValue?: string) => {
      if (!monthValue) return false;
      const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
      return dayjs(rawDate).format("YYYY-MM") === monthValue;
    };
    const matchesCustomRange = (order: Order) => {
      if (!kpiCustomRange) return true;
      const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
      const d = dayjs(rawDate);
      return !d.isBefore(kpiCustomRange[0].startOf("day")) && !d.isAfter(kpiCustomRange[1].endOf("day"));
    };
    if (kpiScope === "monthA") return orders.filter((o) => matchesMonth(o, compareMonthA));
    if (kpiScope === "monthB") return orders.filter((o) => matchesMonth(o, compareMonthB));
    if (kpiScope === "customRange") return orders.filter(matchesCustomRange);
    return orders;
  }, [orders, kpiScope, compareMonthA, compareMonthB, kpiCustomRange]);

  const totalPurchased = useMemo(
    () => scopedOrders.reduce((sum, order) => sum + Number(order.totalPrice ?? 0), 0),
    [scopedOrders],
  );
  const scopedDistinctItemsCount = useMemo(() => {
    const unique = new Set<string>();
    for (const order of scopedOrders) {
      for (const item of (order.orderItems ?? []) as OrderItem[]) {
        unique.add(item.product?.name ?? "Ítem sin nombre");
      }
    }
    return unique.size;
  }, [scopedOrders]);

  const monthOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const order of orders) {
      const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
      const parsedDate = dayjs(rawDate);
      if (!parsedDate.isValid()) continue;
      unique.add(parsedDate.format("YYYY-MM"));
    }
    return Array.from(unique)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: dayjs(`${value}-01`).format("MM/YYYY") }));
  }, [orders]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      setCompareMonthA(undefined);
      setCompareMonthB(undefined);
      return;
    }
    setCompareMonthA((prev) => prev ?? monthOptions[0]?.value);
    setCompareMonthB((prev) => prev ?? monthOptions[1]?.value ?? monthOptions[0]?.value);
  }, [monthOptions]);

  const monthlyComparisonKpis = useMemo(() => {
    if (!compareMonthA || !compareMonthB) return null;
    const countForMonth = (targetMonth: string) =>
      orders.filter((order) => {
        const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
        return dayjs(rawDate).format("YYYY-MM") === targetMonth;
      }).length;
    const monthACount = countForMonth(compareMonthA);
    const monthBCount = countForMonth(compareMonthB);
    return {
      monthACount,
      monthBCount,
      delta: monthACount - monthBCount,
    };
  }, [compareMonthA, compareMonthB, orders]);

  const itemComparisonByMonth = useMemo(() => {
    if (!compareMonthA || !compareMonthB) return [];
    const byMonthItem = new Map<string, Map<string, number>>();
    const addItem = (monthKey: string, itemName: string, qty: number) => {
      const monthMap = byMonthItem.get(monthKey) ?? new Map<string, number>();
      monthMap.set(itemName, (monthMap.get(itemName) ?? 0) + qty);
      byMonthItem.set(monthKey, monthMap);
    };
    for (const order of orders) {
      const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
      const monthKey = dayjs(rawDate).format("YYYY-MM");
      if (monthKey !== compareMonthA && monthKey !== compareMonthB) continue;
      for (const item of (order.orderItems ?? []) as OrderItem[]) {
        addItem(monthKey, item.product?.name ?? "Ítem sin nombre", Number(item.quantity ?? 0));
      }
    }
    const monthAMap = byMonthItem.get(compareMonthA) ?? new Map<string, number>();
    const monthBMap = byMonthItem.get(compareMonthB) ?? new Map<string, number>();
    const topNames = Array.from(new Set([...monthAMap.keys(), ...monthBMap.keys()]))
      .map((name) => ({ name, total: (monthAMap.get(name) ?? 0) + (monthBMap.get(name) ?? 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((x) => x.name);
    return topNames.map((name) => ({
      name,
      monthA: monthAMap.get(name) ?? 0,
      monthB: monthBMap.get(name) ?? 0,
    }));
  }, [compareMonthA, compareMonthB, orders]);

  const formatMonthEs = (monthValue?: string) => {
    if (!monthValue) return "";
    const [year, month] = monthValue.split("-").map(Number);
    if (!year || !month) return monthValue;
    return new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  };
  const compareMonthALabel = compareMonthA ? formatMonthEs(compareMonthA) : "Mes A";
  const compareMonthBLabel = compareMonthB ? formatMonthEs(compareMonthB) : "Mes B";
  const itemBarData = useMemo(() => itemBreakdown.slice(0, isMobile ? 6 : 10), [itemBreakdown, isMobile]);

  const crmItemsBarMinWidthPx = useMemo(() => {
    if (!isMobile || itemBarData.length === 0) return null as number | null;
    const longest = itemBarData.reduce((m, r) => Math.max(m, r.name?.length ?? 0), 8);
    return Math.min(780, Math.max(300, longest * 6.5 + 200));
  }, [isMobile, itemBarData]);

  const crmItemsYAxisWidth = useMemo(() => {
    const longest = itemBarData.reduce((m, r) => Math.max(m, r.name?.length ?? 0), 8);
    if (!isMobile) return Math.min(200, longest * 5.5 + 24);
    return Math.min(300, Math.max(120, longest * 6));
  }, [isMobile, itemBarData]);

  const monthlyBarMinWidthPx = useMemo(() => {
    if (!isMobile || monthlyOrdersSeries.length === 0) return null as number | null;
    return Math.min(980, Math.max(300, monthlyOrdersSeries.length * 52 + 40));
  }, [isMobile, monthlyOrdersSeries]);

  const comparisonBarMinWidthPx = useMemo(() => {
    if (!isMobile || itemComparisonByMonth.length === 0) return null as number | null;
    const n = itemComparisonByMonth.length;
    const longest = itemComparisonByMonth.reduce((m, r) => Math.max(m, r.name?.length ?? 0), 6);
    return Math.min(900, Math.max(320, n * 64 + longest * 4 + 40));
  }, [isMobile, itemComparisonByMonth]);
  const orderHistoryColumns = useMemo(() => {
    if (isMobile) {
      return [
        {
          title: "Total",
          dataIndex: "totalPrice",
          key: "totalPrice",
          width: 120,
          render: (amount: number | string) => formatCurrency(amount),
        },
        {
          title: "Pago",
          key: "paymentStatus",
          width: 90,
          render: (_: unknown, order: Order) => (
            <Tag
              color={
                order.paymentStatus === "PAID" ? "green" : order.paymentStatus === "PARTIALLY_PAID" ? "gold" : "default"
              }
            >
              {orderPaymentStatusLabel(order.paymentStatus as OrderPaymentStatus)}
            </Tag>
          ),
        },
        {
          title: "Fecha",
          key: "deliveryDate",
          width: 96,
          render: (_: unknown, order: Order) =>
            order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—",
        },
        {
          title: "",
          key: "actions",
          width: 56,
          render: (_: unknown, order: Order) => (
            <Button
              size="small"
              icon={<EyeOutlined />}
              aria-label="Ver detalle"
              title="Ver detalle"
              onClick={() => void openOrderDetail(order.id)}
            />
          ),
        },
      ];
    }
    return [
      {
        title: "Total",
        dataIndex: "totalPrice",
        key: "totalPrice",
        width: 120,
        render: (amount: number | string) => formatCurrency(amount),
      },
      {
        title: "Estado de pago",
        key: "paymentStatus",
        width: 136,
        render: (_: unknown, order: Order) => (
          <Tag
            color={
              order.paymentStatus === "PAID" ? "green" : order.paymentStatus === "PARTIALLY_PAID" ? "gold" : "default"
            }
          >
            {orderPaymentStatusLabel(order.paymentStatus as OrderPaymentStatus)}
          </Tag>
        ),
      },
      {
        title: "Pagado",
        key: "paidAmount",
        width: 120,
        render: (_: unknown, order: Order) => formatCurrency(order.paidAmount ?? 0),
      },
      {
        title: "Medios de pago",
        key: "paymentMethods",
        width: 200,
        render: (_: unknown, order: Order) => formatPaymentMethodsOnly(order.payments),
      },
      {
        title: "Pendiente",
        key: "remainingAmount",
        width: 120,
        render: (_: unknown, order: Order) => formatCurrency(order.remainingAmount ?? 0),
      },
      {
        title: "Lista de precios",
        key: "priceListType",
        width: 120,
        render: (_: unknown, order: Order) => orderPriceListDisplayLabel(order.priceListType),
      },
      {
        title: "Cant. ítems",
        dataIndex: "orderItems",
        key: "itemsCount",
        width: 90,
        render: (items: OrderItem[]) => items?.length || 0,
      },
      {
        title: "Programada",
        key: "deliveryDate",
        width: 110,
        render: (_: unknown, order: Order) =>
          order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—",
      },
      {
        title: "Entregada",
        key: "isDelivered",
        width: 96,
        render: (_: unknown, order: Order) => (order.isDelivered ? "Sí" : "No"),
      },
      {
        title: "Stock desde",
        key: "fulfillmentLocation",
        width: 120,
        render: (_: unknown, order: Order) => order.fulfillmentLocation?.name ?? "—",
      },
      {
        title: "Detalle",
        key: "actions",
        width: 90,
        render: (_: unknown, order: Order) => (
          <Button
            size="small"
            icon={<EyeOutlined />}
            aria-label="Ver detalle"
            title="Ver detalle"
            onClick={() => void openOrderDetail(order.id)}
          />
        ),
      },
    ];
  }, [isMobile, openOrderDetail]);

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
          <Descriptions.Item label="Último vínculo (pedido o seguimiento)">
            {detail.lastContactAt ? new Date(detail.lastContactAt).toLocaleString("es-AR") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Última entrega (pedidos)">
            {detail.lastOrderDeliveryAt ? new Date(detail.lastOrderDeliveryAt).toLocaleString("es-AR") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Último seguimiento CRM">
            {detail.lastInteractionAt ? new Date(detail.lastInteractionAt).toLocaleString("es-AR") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Días sin vínculo">
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
            label: "Seguimiento comercial",
            children: (
              <Card
                title={
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af" }}>
                    Llamadas, mails o WhatsApp que registrás vos; va al KPI &quot;días sin vínculo&quot; si no hay un
                    pedido más reciente.
                  </span>
                }
                extra={
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setAddInteractionOpen(true)}
                  >
                    Registrar seguimiento
                  </Button>
                }
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  {detail.interactions.length === 0 ? (
                    <span style={{ color: "#9ca3af" }}>Aún no hay seguimientos registrados.</span>
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
            label: "Oportunidad de venta",
            children: (
              <Card
                title={
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af" }}>
                    Acuerdos o negocios en curso (etapa, monto esperado); no sustituye al historial de pedidos ni al
                    seguimiento comercial arriba.
                  </span>
                }
                extra={
                  <Button
                    type="primary"
                    size="small"
                    icon={detail.opportunity ? <EditOutlined /> : <PlusOutlined />}
                    onClick={() => setEditOpportunityOpen(true)}
                  >
                    {detail.opportunity ? "Editar" : "Registrar"} oportunidad
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
          {
            key: "orders",
            label: "Pedidos",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size={16}>
                <Card>
                  <Space direction="vertical" style={{ width: "100%" }} size={12}>
                    <Space wrap style={{ width: "100%" }}>
                      <Select
                        value={kpiScope}
                        style={{ width: isMobile ? "100%" : 280 }}
                        onChange={(value) => setKpiScope(value)}
                        options={[
                          { value: "all", label: "Métricas: todo el historial" },
                          { value: "monthA", label: `Métricas: ${compareMonthALabel}` },
                          { value: "monthB", label: `Métricas: ${compareMonthBLabel}` },
                          { value: "customRange", label: "Métricas: rango personalizado" },
                        ]}
                      />
                      {kpiScope === "customRange" ? (
                        <DatePicker.RangePicker
                          value={kpiCustomRange as any}
                          onChange={(values) => setKpiCustomRange(values as [Dayjs, Dayjs] | null)}
                          format="DD/MM/YYYY"
                          style={{ width: isMobile ? "100%" : undefined }}
                        />
                      ) : null}
                    </Space>
                    <Space size={24} wrap direction={isMobile ? "vertical" : "horizontal"}>
                      <div>
                        <div style={{ color: "#9ca3af", fontSize: 12 }}>Cantidad de pedidos</div>
                        <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>{scopedOrders.length}</div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af", fontSize: 12 }}>Total comprado</div>
                        <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>
                          {formatCurrency(totalPurchased)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af", fontSize: 12 }}>Ítems diferentes pedidos</div>
                        <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>
                          {scopedDistinctItemsCount}
                        </div>
                      </div>
                    </Space>
                  </Space>
                </Card>

                <Card title="Ítems más pedidos (unidades acumuladas)">
                  <div
                    style={{
                      overflowX: isMobile ? "auto" : undefined,
                      WebkitOverflowScrolling: "touch",
                      width: "100%",
                    }}
                  >
                    <div style={{ height: isMobile ? 280 : 260, minWidth: crmItemsBarMinWidthPx ?? "100%" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={itemBarData} layout="vertical" margin={{ left: isMobile ? 12 : 20, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" stroke="#9ca3af" allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            stroke="#9ca3af"
                            width={crmItemsYAxisWidth}
                            interval={0}
                            tick={{ fill: "#9ca3af", fontSize: isMobile ? 11 : 12 }}
                          />
                          <Tooltip />
                          <Bar dataKey="value" name="Unidades" fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>

                <Card title="Pedidos por mes (últimos 12 meses con pedidos)">
                  <div
                    style={{
                      overflowX: isMobile ? "auto" : undefined,
                      WebkitOverflowScrolling: "touch",
                      width: "100%",
                    }}
                  >
                    <div style={{ height: isMobile ? 220 : 260, minWidth: monthlyBarMinWidthPx ?? "100%" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyOrdersSeries} margin={{ bottom: isMobile ? 16 : 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey="month"
                            stroke="#9ca3af"
                            tick={{ fill: "#9ca3af", fontSize: isMobile ? 10 : 12 }}
                            interval={isMobile ? 0 : undefined}
                          />
                          <YAxis stroke="#9ca3af" allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" name="Pedidos" fill="#60a5fa" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>

                <Card title="Comparación de meses (ítems pedidos)">
                  <Space direction="vertical" style={{ width: "100%" }} size={12}>
                    <Space wrap style={{ width: "100%" }}>
                      <Select
                        style={{ width: isMobile ? "100%" : 180 }}
                        placeholder="Mes A"
                        value={compareMonthA}
                        options={monthOptions}
                        onChange={(value) => setCompareMonthA(value)}
                      />
                      <Select
                        style={{ width: isMobile ? "100%" : 180 }}
                        placeholder="Mes B"
                        value={compareMonthB}
                        options={monthOptions}
                        onChange={(value) => setCompareMonthB(value)}
                      />
                    </Space>
                    {monthlyComparisonKpis ? (
                      <Space size={24} wrap>
                        <span style={{ color: "#9ca3af" }}>
                          {dayjs(`${compareMonthA}-01`).format("MM/YYYY")}:{" "}
                          <strong style={{ color: "#fafafa" }}>{monthlyComparisonKpis.monthACount}</strong> pedidos
                        </span>
                        <span style={{ color: "#9ca3af" }}>
                          {dayjs(`${compareMonthB}-01`).format("MM/YYYY")}:{" "}
                          <strong style={{ color: "#fafafa" }}>{monthlyComparisonKpis.monthBCount}</strong> pedidos
                        </span>
                        <span style={{ color: monthlyComparisonKpis.delta >= 0 ? "#22c55e" : "#f43f5e" }}>
                          Delta: {monthlyComparisonKpis.delta >= 0 ? "+" : ""}
                          {monthlyComparisonKpis.delta}
                        </span>
                      </Space>
                    ) : null}
                    <div
                      style={{
                        overflowX: isMobile ? "auto" : undefined,
                        WebkitOverflowScrolling: "touch",
                        width: "100%",
                      }}
                    >
                      <div style={{ height: isMobile ? 280 : 300, minWidth: comparisonBarMinWidthPx ?? "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={itemComparisonByMonth}
                            margin={{ left: 4, right: 8, top: 8, bottom: isMobile ? 112 : 64 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="name"
                              stroke="#9ca3af"
                              interval={0}
                              angle={isMobile ? -42 : -20}
                              textAnchor="end"
                              height={isMobile ? 110 : 72}
                              tick={{ fill: "#9ca3af", fontSize: isMobile ? 9 : 12 }}
                            />
                            <YAxis stroke="#9ca3af" allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: isMobile ? 11 : undefined }} />
                            <Bar
                              dataKey="monthA"
                              name={compareMonthA ? dayjs(`${compareMonthA}-01`).format("MM/YYYY") : "Mes A"}
                              fill="#60a5fa"
                            />
                            <Bar
                              dataKey="monthB"
                              name={compareMonthB ? dayjs(`${compareMonthB}-01`).format("MM/YYYY") : "Mes B"}
                              fill="#f59e0b"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Space>
                </Card>

                <Card title="Historial de pedidos">
                  <Spin spinning={ordersLoading}>
                    <Table
                      rowKey="id"
                      dataSource={orders}
                      size="small"
                      pagination={{ pageSize: isMobile ? 6 : 8, size: isMobile ? "small" : "default" }}
                      scroll={isMobile ? undefined : { x: 980 }}
                      columns={orderHistoryColumns as any}
                    />
                  </Spin>
                </Card>
              </Space>
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
        destroyOnClose
        afterOpenChange={(open) => {
          if (!open || !detail) return;
          profileForm.setFieldsValue({
            contactName: detail.contactName,
            phone: detail.phone,
            email: detail.email,
            customerType: detail.customerType,
            status: normalizeCrmStatusForForm(detail.status) ?? detail.status ?? undefined,
            source: detail.source,
            responsibleId: detail.responsibleId,
            generalNotes: detail.generalNotes,
            nextFollowUpAt: detail.nextFollowUpAt ? dayjs(detail.nextFollowUpAt) : null,
          });
        }}
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
              showSearch
              optionFilterProp="label"
              placeholder="Empresa o particular"
              options={profileCustomerTypeOptions}
            />
          </Form.Item>
          <Form.Item name="status" label="Estado del contacto">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Seleccioná un estado"
              options={profileStatusOptions}
            />
          </Form.Item>
          <Form.Item name="source" label="¿De dónde nos conoció? (origen del cliente)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Elegí un origen"
              options={profileSourceOptions}
            />
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
        destroyOnClose
        afterOpenChange={(open) => {
          if (!open || !detail) return;
          if (detail.opportunity) {
            opportunityForm.setFieldsValue({
              stage: detail.opportunity.stage,
              estimatedValue: detail.opportunity.estimatedValue,
              expectedClosingDate: detail.opportunity.expectedClosingDate
                ? dayjs(detail.opportunity.expectedClosingDate)
                : null,
              notes: detail.opportunity.notes,
            });
          } else {
            opportunityForm.resetFields();
          }
        }}
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
        title="Registrar seguimiento"
        open={addInteractionOpen}
        onCancel={() => setAddInteractionOpen(false)}
        onOk={() => interactionForm.submit()}
        okText="Agregar"
        width={500}
        destroyOnClose
        afterOpenChange={(open) => {
          if (!open) return;
          interactionForm.resetFields();
          interactionForm.setFieldsValue({ date: dayjs() });
        }}
      >
        <Form form={interactionForm} layout="vertical" onFinish={handleAddInteraction}>
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

      <Modal
        title="Detalle del pedido"
        open={viewOrderOpen}
        onCancel={() => {
          setViewOrderOpen(false);
          setModalOrder(null);
        }}
        footer={<Button onClick={() => setViewOrderOpen(false)}>Cerrar</Button>}
        width={isMobile ? "calc(100vw - 24px)" : 920}
        destroyOnClose
        styles={{ body: { maxHeight: "75vh", overflowY: "auto" } }}
      >
        {modalOrderLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : null}
        {modalOrder ? (
          <OrderDetailView
            key={modalOrder.id}
            order={modalOrder}
            onOrderUpdated={(updatedOrder) => {
              setModalOrder(updatedOrder);
              setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
