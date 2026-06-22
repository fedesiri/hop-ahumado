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
import dayjs from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { formatPaymentMethodsOnly, orderPaymentStatusLabel } from "@/lib/order-labels";
import { toast } from "@/lib/toast";
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
import { ArrowLeft, Edit, Eye, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite", verticalAlign: "middle" }} />
  );
}

function DescRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={{ color: "var(--ha-text-3)", fontSize: 12 }}>{label}</span>
      <div style={{ color: "#f1f5f9", marginTop: 2 }}>{children}</div>
    </div>
  );
}

export default function CrmCustomerDetailPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("interactions");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editOpportunityOpen, setEditOpportunityOpen] = useState(false);
  const [addInteractionOpen, setAddInteractionOpen] = useState(false);
  const [viewOrderOpen, setViewOrderOpen] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalOrderLoading, setModalOrderLoading] = useState(false);
  const [compareMonthA, setCompareMonthA] = useState<string | undefined>(undefined);
  const [compareMonthB, setCompareMonthB] = useState<string | undefined>(undefined);
  const [kpiScope, setKpiScope] = useState<"all" | "monthA" | "monthB" | "customRange">("all");
  const [kpiRangeFrom, setKpiRangeFrom] = useState("");
  const [kpiRangeTo, setKpiRangeTo] = useState("");

  // Profile form state
  const [pfContactName, setPfContactName] = useState("");
  const [pfPhone, setPfPhone] = useState("");
  const [pfEmail, setPfEmail] = useState("");
  const [pfCustomerType, setPfCustomerType] = useState("");
  const [pfStatus, setPfStatus] = useState("");
  const [pfSource, setPfSource] = useState("");
  const [pfResponsibleId, setPfResponsibleId] = useState("");
  const [pfGeneralNotes, setPfGeneralNotes] = useState("");
  const [pfNextFollowUpAt, setPfNextFollowUpAt] = useState("");
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // Opportunity form state
  const [ofStage, setOfStage] = useState("");
  const [ofEstimatedValue, setOfEstimatedValue] = useState("");
  const [ofExpectedClosingDate, setOfExpectedClosingDate] = useState("");
  const [ofNotes, setOfNotes] = useState("");
  const [submittingOpportunity, setSubmittingOpportunity] = useState(false);

  // Interaction form state
  const [ifChannel, setIfChannel] = useState<InteractionChannel | "">("");
  const [ifDate, setIfDate] = useState("");
  const [ifNotes, setIfNotes] = useState("");
  const [ifNextStep, setIfNextStep] = useState("");
  const [submittingInteraction, setSubmittingInteraction] = useState(false);

  const profileStatusOptions = useMemo(
    () => mergeCrmSelectOptions(detail ? (normalizeCrmStatusForForm(detail.status) ?? detail.status ?? undefined) : undefined, CRM_STATUS_OPTIONS),
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

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCrmCustomerDetail(profileId);
      setDetail(data);
    } catch {
      toast.error("Error al cargar el cliente");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient.getUsers(1, 100);
      setUsers(res.data);
    } catch {
      // silent
    }
  }, []);

  const fetchOrders = useCallback(async (customerId: string) => {
    try {
      setOrdersLoading(true);
      const response = await apiClient.getOrders(1, 100, customerId);
      setOrders(response.data);
    } catch {
      toast.error("Error al cargar pedidos del cliente");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileId) { void fetchDetail(); void fetchUsers(); }
  }, [profileId, fetchDetail, fetchUsers]);

  useEffect(() => {
    if (detail?.customer?.id) void fetchOrders(detail.customer.id);
  }, [detail?.customer?.id, fetchOrders]);

  // Populate profile form when modal opens
  useEffect(() => {
    if (editProfileOpen && detail) {
      setPfContactName(detail.contactName ?? "");
      setPfPhone(detail.phone ?? "");
      setPfEmail(detail.email ?? "");
      setPfCustomerType(detail.customerType ?? "");
      setPfStatus(normalizeCrmStatusForForm(detail.status) ?? detail.status ?? "");
      setPfSource(detail.source ?? "");
      setPfResponsibleId(detail.responsibleId ?? "");
      setPfGeneralNotes(detail.generalNotes ?? "");
      setPfNextFollowUpAt(detail.nextFollowUpAt ? dayjs(detail.nextFollowUpAt).format("YYYY-MM-DD") : "");
    }
  }, [editProfileOpen]);

  // Populate opportunity form when modal opens
  useEffect(() => {
    if (editOpportunityOpen && detail) {
      if (detail.opportunity) {
        setOfStage(detail.opportunity.stage ?? "");
        setOfEstimatedValue(detail.opportunity.estimatedValue != null ? String(detail.opportunity.estimatedValue) : "");
        setOfExpectedClosingDate(detail.opportunity.expectedClosingDate ? dayjs(detail.opportunity.expectedClosingDate).format("YYYY-MM-DD") : "");
        setOfNotes(detail.opportunity.notes ?? "");
      } else {
        setOfStage(""); setOfEstimatedValue(""); setOfExpectedClosingDate(""); setOfNotes("");
      }
    }
  }, [editOpportunityOpen]);

  // Set now when interaction modal opens
  useEffect(() => {
    if (addInteractionOpen) {
      setIfChannel(""); setIfDate(dayjs().format("YYYY-MM-DDTHH:mm")); setIfNotes(""); setIfNextStep("");
    }
  }, [addInteractionOpen]);

  const openOrderDetail = async (orderId: string) => {
    setViewOrderOpen(true);
    setModalOrder(null);
    setModalOrderLoading(true);
    try {
      const detailOrder = await apiClient.getOrder(orderId);
      setModalOrder(detailOrder);
    } catch {
      toast.error("No se pudo cargar el detalle del pedido");
      setViewOrderOpen(false);
    } finally {
      setModalOrderLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setSubmittingProfile(true);
    try {
      const payload: UpdateCustomerProfileRequest = {
        contactName: pfContactName || undefined,
        phone: pfPhone || undefined,
        email: pfEmail.trim() || undefined,
        customerType: pfCustomerType || undefined,
        status: pfStatus || undefined,
        source: pfSource || undefined,
        responsibleId: pfResponsibleId || undefined,
        generalNotes: pfGeneralNotes || undefined,
        nextFollowUpAt: pfNextFollowUpAt ? new Date(pfNextFollowUpAt).toISOString() : undefined,
      };
      await apiClient.updateCrmCustomerProfile(profileId, payload);
      toast.success("Perfil actualizado");
      setEditProfileOpen(false);
      void fetchDetail();
    } catch {
      toast.error("Error al actualizar");
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleUpsertOpportunity = async () => {
    setSubmittingOpportunity(true);
    try {
      const raw = ofEstimatedValue;
      const estimatedValue = raw === "" ? undefined : Number(raw);
      const payload: UpdateCustomerOpportunityRequest = {
        stage: ofStage || undefined,
        notes: ofNotes || undefined,
        expectedClosingDate: ofExpectedClosingDate ? new Date(ofExpectedClosingDate).toISOString() : undefined,
      };
      if (estimatedValue !== undefined && !Number.isNaN(estimatedValue)) payload.estimatedValue = estimatedValue;
      await apiClient.upsertCrmCustomerOpportunity(profileId, payload);
      toast.success("Oportunidad guardada");
      setEditOpportunityOpen(false);
      void fetchDetail();
    } catch {
      toast.error("Error al guardar oportunidad");
    } finally {
      setSubmittingOpportunity(false);
    }
  };

  const handleAddInteraction = async () => {
    setSubmittingInteraction(true);
    try {
      await apiClient.createCrmCustomerInteraction(profileId, {
        channel: ifChannel || undefined,
        date: ifDate ? new Date(ifDate).toISOString() : undefined,
        notes: ifNotes || undefined,
        nextStep: ifNextStep || undefined,
      });
      toast.success("Seguimiento registrado");
      setAddInteractionOpen(false);
      void fetchDetail();
    } catch {
      toast.error("Error al registrar seguimiento");
    } finally {
      setSubmittingInteraction(false);
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
    return Array.from(map.values()).sort((a, b) => a.monthSort.localeCompare(b.monthSort)).slice(-12);
  }, [orders]);

  const itemBreakdown = useMemo(() => {
    const byItem = new Map<string, number>();
    for (const order of orders) {
      for (const item of (order.orderItems ?? []) as OrderItem[]) {
        const itemName = item.product?.name ?? "Ítem sin nombre";
        byItem.set(itemName, (byItem.get(itemName) ?? 0) + Number(item.quantity ?? 0));
      }
    }
    return Array.from(byItem.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  const scopedOrders = useMemo(() => {
    const matchesMonth = (order: Order, monthValue?: string) => {
      if (!monthValue) return false;
      const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
      return dayjs(rawDate).format("YYYY-MM") === monthValue;
    };
    const matchesCustomRange = (order: Order) => {
      if (!kpiRangeFrom || !kpiRangeTo) return true;
      const rawDate = order.deliveredAt || order.deliveryDate || order.createdAt;
      const d = dayjs(rawDate);
      return !d.isBefore(dayjs(kpiRangeFrom).startOf("day")) && !d.isAfter(dayjs(kpiRangeTo).endOf("day"));
    };
    if (kpiScope === "monthA") return orders.filter((o) => matchesMonth(o, compareMonthA));
    if (kpiScope === "monthB") return orders.filter((o) => matchesMonth(o, compareMonthB));
    if (kpiScope === "customRange") return orders.filter(matchesCustomRange);
    return orders;
  }, [orders, kpiScope, compareMonthA, compareMonthB, kpiRangeFrom, kpiRangeTo]);

  const totalPurchased = useMemo(() => scopedOrders.reduce((sum, order) => sum + Number(order.totalPrice ?? 0), 0), [scopedOrders]);

  const scopedDistinctItemsCount = useMemo(() => {
    const unique = new Set<string>();
    for (const order of scopedOrders) {
      for (const item of (order.orderItems ?? []) as OrderItem[]) unique.add(item.product?.name ?? "Ítem sin nombre");
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
    return Array.from(unique).sort((a, b) => b.localeCompare(a)).map((value) => ({ value, label: dayjs(`${value}-01`).format("MM/YYYY") }));
  }, [orders]);

  useEffect(() => {
    if (monthOptions.length === 0) { setCompareMonthA(undefined); setCompareMonthB(undefined); return; }
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
    return { monthACount, monthBCount, delta: monthACount - monthBCount };
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
      .sort((a, b) => b.total - a.total).slice(0, 8).map((x) => x.name);
    return topNames.map((name) => ({ name, monthA: monthAMap.get(name) ?? 0, monthB: monthBMap.get(name) ?? 0 }));
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

  const crmKpiAnalysis = useMemo(() => {
    if (scopedOrders.length === 0) return null;
    const avgTicket = totalPurchased / scopedOrders.length;
    const activeMths = new Set(scopedOrders.map((o) => dayjs(o.deliveredAt || o.deliveryDate || o.createdAt).format("YYYY-MM"))).size;
    return { avgTicket, activeMths };
  }, [scopedOrders, totalPurchased]);

  const crmTopItemsAnalysis = useMemo(() => {
    if (itemBarData.length === 0) return null;
    const total = itemBarData.reduce((s, i) => s + i.value, 0);
    const top3Total = itemBarData.slice(0, 3).reduce((s, i) => s + i.value, 0);
    const top3Pct = total > 0 ? Math.round((top3Total / total) * 100) : 0;
    return { top: itemBarData[0], top3Pct };
  }, [itemBarData]);

  const crmMonthlyAnalysis = useMemo(() => {
    if (monthlyOrdersSeries.length === 0) return null;
    const sorted = [...monthlyOrdersSeries].sort((a, b) => b.count - a.count);
    const best = sorted[0];
    const last3 = monthlyOrdersSeries.slice(-3);
    const prev3 = monthlyOrdersSeries.slice(-6, -3);
    let trend = "";
    if (last3.length === 3 && prev3.length >= 2) {
      const lastAvg = last3.reduce((s, m) => s + m.count, 0) / 3;
      const prevAvg = prev3.reduce((s, m) => s + m.count, 0) / prev3.length;
      if (lastAvg > prevAvg * 1.1) trend = "La tendencia reciente es al alza.";
      else if (lastAvg < prevAvg * 0.9) trend = "La tendencia reciente es a la baja.";
      else trend = "La tendencia reciente es estable.";
    }
    return { best, trend };
  }, [monthlyOrdersSeries]);

  const crmComparisonAnalysis = useMemo(() => {
    if (!monthlyComparisonKpis || itemComparisonByMonth.length === 0) return null;
    const grew = [...itemComparisonByMonth].sort((a, b) => b.monthA - b.monthB - (a.monthA - a.monthB))[0];
    const fell = [...itemComparisonByMonth].sort((a, b) => a.monthA - a.monthB - (b.monthA - b.monthB))[0];
    const pct = monthlyComparisonKpis.monthBCount > 0
      ? Math.round(((monthlyComparisonKpis.monthACount - monthlyComparisonKpis.monthBCount) / monthlyComparisonKpis.monthBCount) * 100)
      : null;
    return { grew, fell, pct };
  }, [monthlyComparisonKpis, itemComparisonByMonth]);

  if (loading && !detail) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
      </div>
    );
  }

  if (!detail) return null;

  const TABS = [
    { key: "interactions", label: "Seguimiento comercial" },
    { key: "opportunity", label: "Oportunidad de venta" },
    { key: "orders", label: "Pedidos" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/crm" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#9ca3af", textDecoration: "none", fontSize: 14 }}>
          <ArrowLeft size={16} /> Volver al listado
        </Link>
      </div>

      {/* Profile card */}
      <div style={{ marginBottom: 16, padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0, color: "#fafafa", fontSize: 18 }}>
            {detail.customer.name}{detail.contactName ? ` — ${detail.contactName}` : ""}
          </h2>
          <button className="ha-btn ha-btn--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setEditProfileOpen(true)}>
            <Edit size={14} /> Editar perfil
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px 24px" }}>
          <DescRow label="Nombre o razón social">{detail.customer.name}</DescRow>
          <DescRow label="Tipo de cliente">{detail.customerType ?? "—"}</DescRow>
          <DescRow label="Persona de contacto">{detail.contactName ?? "—"}</DescRow>
          <DescRow label="Teléfono">{detail.phone ?? "—"}</DescRow>
          <DescRow label="Email">{detail.email ?? "—"}</DescRow>
          <DescRow label="Estado del contacto">{formatStatusLabel(detail.status) || "—"}</DescRow>
          <DescRow label="¿De dónde nos conoció?">{detail.source ?? "—"}</DescRow>
          <DescRow label="Socio responsable">{detail.responsible?.name ?? "—"}</DescRow>
          <DescRow label="Último vínculo">{detail.lastContactAt ? new Date(detail.lastContactAt).toLocaleString("es-AR") : "—"}</DescRow>
          <DescRow label="Última entrega">{detail.lastOrderDeliveryAt ? new Date(detail.lastOrderDeliveryAt).toLocaleString("es-AR") : "—"}</DescRow>
          <DescRow label="Último seguimiento CRM">{detail.lastInteractionAt ? new Date(detail.lastInteractionAt).toLocaleString("es-AR") : "—"}</DescRow>
          <DescRow label="Días sin vínculo">{detail.daysSinceLastContact != null ? detail.daysSinceLastContact : "—"}</DescRow>
          <DescRow label="Próximo seguimiento">{detail.nextFollowUpAt ? dayjs(detail.nextFollowUpAt).format("DD/MM/YYYY") : "—"}</DescRow>
          <DescRow label="Notas generales">{detail.generalNotes ?? "—"}</DescRow>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--ha-border-1)", marginBottom: 16, overflowX: "auto" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: "none", border: "none", padding: "10px 16px", cursor: "pointer", fontWeight: 500, fontSize: 14, whiteSpace: "nowrap",
              color: activeTab === tab.key ? "var(--ha-amber)" : "var(--ha-text-3)",
              borderBottom: activeTab === tab.key ? "2px solid var(--ha-amber)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Seguimiento comercial */}
      {activeTab === "interactions" && (
        <div style={{ padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
              Llamadas, mails o WhatsApp que registrás vos; va al KPI &quot;días sin vínculo&quot; si no hay un pedido más reciente.
            </p>
            <button className="ha-btn ha-btn--primary ha-btn--sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => setAddInteractionOpen(true)}>
              <Plus size={13} /> Registrar seguimiento
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {detail.interactions.length === 0 ? (
              <span style={{ color: "#9ca3af" }}>Aún no hay seguimientos registrados.</span>
            ) : (
              detail.interactions.map((i) => (
                <div key={i.id} style={{ padding: "10px 14px", borderRadius: 8, background: "#0f172a", border: "1px solid #1e293b" }}>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>
                    {new Date(i.date).toLocaleString("es-AR")} · {i.channel ?? "—"}
                  </div>
                  {i.notes && <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{i.notes}</p>}
                  {i.nextStep && <p style={{ margin: "4px 0 0", color: "#22c55e", fontSize: 12 }}>Próximo paso: {i.nextStep}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Oportunidad */}
      {activeTab === "opportunity" && (
        <div style={{ padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
              Acuerdos o negocios en curso (etapa, monto esperado); no sustituye al historial de pedidos ni al seguimiento comercial.
            </p>
            <button className="ha-btn ha-btn--primary ha-btn--sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => setEditOpportunityOpen(true)}>
              {detail.opportunity ? <><Edit size={13} /> Editar</> : <><Plus size={13} /> Registrar</>} oportunidad
            </button>
          </div>
          {detail.opportunity ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px 24px" }}>
              <DescRow label="Etapa">{detail.opportunity.stage ?? "—"}</DescRow>
              <DescRow label="Valor estimado">{detail.opportunity.estimatedValue != null ? String(detail.opportunity.estimatedValue) : "—"}</DescRow>
              <DescRow label="Fecha cierre estimada">{detail.opportunity.expectedClosingDate ? dayjs(detail.opportunity.expectedClosingDate).format("DD/MM/YYYY") : "—"}</DescRow>
              <DescRow label="Notas">{detail.opportunity.notes ?? "—"}</DescRow>
            </div>
          ) : (
            <span style={{ color: "#9ca3af" }}>Sin oportunidad cargada</span>
          )}
        </div>
      )}

      {/* Tab: Pedidos */}
      {activeTab === "orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs */}
          <div style={{ padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "center" }}>
              <select
                className="ha-input"
                style={{ minWidth: isMobile ? "100%" : 280, width: "auto" }}
                value={kpiScope}
                onChange={(e) => setKpiScope(e.target.value as typeof kpiScope)}
              >
                <option value="all">Métricas: todo el historial</option>
                <option value="monthA">Métricas: {compareMonthALabel}</option>
                <option value="monthB">Métricas: {compareMonthBLabel}</option>
                <option value="customRange">Métricas: rango personalizado</option>
              </select>
              {kpiScope === "customRange" && (
                <>
                  <input type="date" className="ha-input" style={{ width: isMobile ? "100%" : 160 }} value={kpiRangeFrom} onChange={(e) => setKpiRangeFrom(e.target.value)} />
                  <span style={{ color: "var(--ha-text-3)" }}>—</span>
                  <input type="date" className="ha-input" style={{ width: isMobile ? "100%" : 160 }} value={kpiRangeTo} onChange={(e) => setKpiRangeTo(e.target.value)} />
                </>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 12 : 24 }}>
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Cantidad de pedidos</div>
                <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>{scopedOrders.length}</div>
              </div>
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Total comprado</div>
                <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>{formatCurrency(totalPurchased)}</div>
              </div>
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Ítems diferentes pedidos</div>
                <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>{scopedDistinctItemsCount}</div>
              </div>
            </div>
            {crmKpiAnalysis && (
              <CrmAnalysisBlock>
                Ticket promedio de <strong>{formatCurrency(crmKpiAnalysis.avgTicket)}</strong> por pedido.
                Compró en <strong>{crmKpiAnalysis.activeMths}</strong> mes{crmKpiAnalysis.activeMths !== 1 ? "es" : ""} distintos
                {scopedOrders.length > 0 ? ` con un total de ${scopedDistinctItemsCount} producto${scopedDistinctItemsCount !== 1 ? "s" : ""} diferente${scopedDistinctItemsCount !== 1 ? "s" : ""}` : ""}.
              </CrmAnalysisBlock>
            )}
          </div>

          {/* Items chart */}
          <div style={{ padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#fafafa", fontSize: 14, fontWeight: 600 }}>Ítems más pedidos (unidades acumuladas)</h3>
            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 280 : 260, minWidth: crmItemsBarMinWidthPx ?? "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemBarData} layout="vertical" margin={{ left: isMobile ? 12 : 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#9ca3af" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" width={crmItemsYAxisWidth} interval={0} tick={{ fill: "#9ca3af", fontSize: isMobile ? 11 : 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Unidades" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {crmTopItemsAnalysis && (
              <CrmAnalysisBlock>
                Su producto preferido es <strong>{crmTopItemsAnalysis.top.name}</strong> con <strong>{crmTopItemsAnalysis.top.value}</strong> unidades acumuladas.
                {itemBarData.length >= 3 ? ` Los 3 primeros productos representan el ${crmTopItemsAnalysis.top3Pct}% del total pedido.` : ""}
              </CrmAnalysisBlock>
            )}
          </div>

          {/* Monthly chart */}
          <div style={{ padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#fafafa", fontSize: 14, fontWeight: 600 }}>Pedidos por mes (últimos 12 meses con pedidos)</h3>
            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 220 : 260, minWidth: monthlyBarMinWidthPx ?? "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyOrdersSeries} margin={{ bottom: isMobile ? 16 : 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: isMobile ? 10 : 12 }} interval={isMobile ? 0 : undefined} />
                    <YAxis stroke="#9ca3af" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Pedidos" fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {crmMonthlyAnalysis && (
              <CrmAnalysisBlock>
                El mes más activo fue <strong>{crmMonthlyAnalysis.best.month}</strong> con <strong>{crmMonthlyAnalysis.best.count}</strong> pedido{crmMonthlyAnalysis.best.count !== 1 ? "s" : ""}.
                {crmMonthlyAnalysis.trend ? ` ${crmMonthlyAnalysis.trend}` : ""}
              </CrmAnalysisBlock>
            )}
          </div>

          {/* Comparison chart */}
          <div style={{ padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#fafafa", fontSize: 14, fontWeight: 600 }}>Comparación de meses (ítems pedidos)</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <select className="ha-input" style={{ width: isMobile ? "100%" : 180 }} value={compareMonthA ?? ""} onChange={(e) => setCompareMonthA(e.target.value || undefined)}>
                <option value="">Mes A</option>
                {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="ha-input" style={{ width: isMobile ? "100%" : 180 }} value={compareMonthB ?? ""} onChange={(e) => setCompareMonthB(e.target.value || undefined)}>
                <option value="">Mes B</option>
                {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {monthlyComparisonKpis && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 12 }}>
                <span style={{ color: "#9ca3af" }}>{dayjs(`${compareMonthA}-01`).format("MM/YYYY")}: <strong style={{ color: "#fafafa" }}>{monthlyComparisonKpis.monthACount}</strong> pedidos</span>
                <span style={{ color: "#9ca3af" }}>{dayjs(`${compareMonthB}-01`).format("MM/YYYY")}: <strong style={{ color: "#fafafa" }}>{monthlyComparisonKpis.monthBCount}</strong> pedidos</span>
                <span style={{ color: monthlyComparisonKpis.delta >= 0 ? "#22c55e" : "#f43f5e" }}>Delta: {monthlyComparisonKpis.delta >= 0 ? "+" : ""}{monthlyComparisonKpis.delta}</span>
              </div>
            )}
            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 280 : 300, minWidth: comparisonBarMinWidthPx ?? "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemComparisonByMonth} margin={{ left: 4, right: 8, top: 8, bottom: isMobile ? 112 : 64 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#9ca3af" interval={0} angle={isMobile ? -42 : -20} textAnchor="end" height={isMobile ? 110 : 72} tick={{ fill: "#9ca3af", fontSize: isMobile ? 9 : 12 }} />
                    <YAxis stroke="#9ca3af" allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 11 : undefined }} />
                    <Bar dataKey="monthA" name={compareMonthA ? dayjs(`${compareMonthA}-01`).format("MM/YYYY") : "Mes A"} fill="#60a5fa" />
                    <Bar dataKey="monthB" name={compareMonthB ? dayjs(`${compareMonthB}-01`).format("MM/YYYY") : "Mes B"} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {crmComparisonAnalysis && (
              <CrmAnalysisBlock>
                {monthlyComparisonKpis && monthlyComparisonKpis.delta !== 0 ? (
                  <><strong>{compareMonthALabel}</strong> {monthlyComparisonKpis.delta > 0 ? "tuvo más pedidos que" : "tuvo menos pedidos que"} <strong>{compareMonthBLabel}</strong>{crmComparisonAnalysis.pct != null ? ` (${crmComparisonAnalysis.pct >= 0 ? "+" : ""}${crmComparisonAnalysis.pct}%)` : ""}. </>
                ) : null}
                {crmComparisonAnalysis.grew && crmComparisonAnalysis.grew.monthA > crmComparisonAnalysis.grew.monthB ? (
                  <>Mayor crecimiento: <strong>{crmComparisonAnalysis.grew.name}</strong> ({crmComparisonAnalysis.grew.monthB} → {crmComparisonAnalysis.grew.monthA} un.). </>
                ) : null}
                {crmComparisonAnalysis.fell && crmComparisonAnalysis.fell.monthB > crmComparisonAnalysis.fell.monthA ? (
                  <>Mayor caída: <strong>{crmComparisonAnalysis.fell.name}</strong> ({crmComparisonAnalysis.fell.monthB} → {crmComparisonAnalysis.fell.monthA} un.).</>
                ) : null}
              </CrmAnalysisBlock>
            )}
          </div>

          {/* Order history table */}
          <div style={{ padding: 16, borderRadius: 10, background: "#1f2937", border: "1px solid var(--ha-border-1)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#fafafa", fontSize: 14, fontWeight: 600 }}>Historial de pedidos</h3>
            {ordersLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} /></div>
            ) : (
              <div className="ha-table-wrap">
                <table className="ha-table">
                  <thead>
                    <tr>
                      <th>Total</th>
                      <th>Estado de pago</th>
                      {!isMobile && <>
                        <th>Pagado</th>
                        <th>Medios de pago</th>
                        <th>Pendiente</th>
                        <th>Lista de precios</th>
                        <th>Cant. ítems</th>
                      </>}
                      <th>{isMobile ? "Fecha" : "Programada"}</th>
                      {!isMobile && <>
                        <th>Entregada</th>
                        <th>Stock desde</th>
                      </>}
                      <th style={{ width: isMobile ? 56 : 90 }}>{isMobile ? "" : "Detalle"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr><td colSpan={isMobile ? 4 : 11} style={{ textAlign: "center", color: "var(--ha-text-3)" }}>Sin pedidos</td></tr>
                    ) : orders.map((order) => {
                      const psColor = order.paymentStatus === "PAID" ? "#4ade80" : order.paymentStatus === "PARTIALLY_PAID" ? "#fbbf24" : "var(--ha-text-3)";
                      return (
                        <tr key={order.id}>
                          <td>{formatCurrency(order.totalPrice)}</td>
                          <td>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, background: `${psColor}22`, color: psColor, border: `1px solid ${psColor}55` }}>
                              {orderPaymentStatusLabel(order.paymentStatus as OrderPaymentStatus)}
                            </span>
                          </td>
                          {!isMobile && <>
                            <td>{formatCurrency(order.paidAmount ?? 0)}</td>
                            <td style={{ color: "var(--ha-text-3)" }}>{formatPaymentMethodsOnly(order.payments)}</td>
                            <td>{formatCurrency(order.remainingAmount ?? 0)}</td>
                            <td style={{ color: "var(--ha-text-3)" }}>{orderPriceListDisplayLabel(order.priceListType)}</td>
                            <td>{order.orderItems?.length || 0}</td>
                          </>}
                          <td style={{ color: "var(--ha-text-3)" }}>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—"}</td>
                          {!isMobile && <>
                            <td>{order.isDelivered ? "Sí" : "No"}</td>
                            <td style={{ color: "var(--ha-text-3)" }}>{order.fulfillmentLocation?.name ?? "—"}</td>
                          </>}
                          <td>
                            <button className="ha-btn ha-btn--secondary ha-btn--sm" style={{ display: "inline-flex", alignItems: "center" }} aria-label="Ver detalle" title="Ver detalle" onClick={() => void openOrderDetail(order.id)}>
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Editar perfil */}
      {editProfileOpen && (
        <div className="ha-modal-backdrop" onClick={() => setEditProfileOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Editar perfil</span>
              <button className="ha-iconbtn" onClick={() => setEditProfileOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body app-panel-scroll" style={{ maxHeight: "calc(85vh - 110px)", overflowY: "auto" }}>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Persona de contacto (opcional)</label>
                <input className="ha-input" placeholder="En empresas: quién atiende" value={pfContactName} onChange={(e) => setPfContactName(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Teléfono</label>
                <input className="ha-input" placeholder="Teléfono de contacto" value={pfPhone} onChange={(e) => setPfPhone(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Email</label>
                <input type="email" className="ha-input" placeholder="Email de contacto" value={pfEmail} onChange={(e) => setPfEmail(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Tipo de cliente</label>
                <select className="ha-input" value={pfCustomerType} onChange={(e) => setPfCustomerType(e.target.value)}>
                  <option value="">Empresa o particular</option>
                  {profileCustomerTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Estado del contacto</label>
                <select className="ha-input" value={pfStatus} onChange={(e) => setPfStatus(e.target.value)}>
                  <option value="">Seleccioná un estado</option>
                  {profileStatusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">¿De dónde nos conoció?</label>
                <select className="ha-input" value={pfSource} onChange={(e) => setPfSource(e.target.value)}>
                  <option value="">Elegí un origen</option>
                  {profileSourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Socio responsable (opcional)</label>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--ha-text-3)" }}>Quién lleva o consiguió este cliente. Puede quedar sin asignar.</p>
                <select className="ha-input" value={pfResponsibleId} onChange={(e) => setPfResponsibleId(e.target.value)}>
                  <option value="">Ninguno</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Notas generales</label>
                <textarea className="ha-input" rows={2} placeholder="Anotaciones sobre el cliente" value={pfGeneralNotes} onChange={(e) => setPfGeneralNotes(e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div className="ha-field">
                <label className="ha-label">Fecha del próximo seguimiento</label>
                <input type="date" className="ha-input" value={pfNextFollowUpAt} onChange={(e) => setPfNextFollowUpAt(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setEditProfileOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" disabled={submittingProfile} onClick={() => void handleUpdateProfile()}>
                {submittingProfile ? <><Spinner /> Guardando…</> : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Oportunidad */}
      {editOpportunityOpen && (
        <div className="ha-modal-backdrop" onClick={() => setEditOpportunityOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">{detail.opportunity ? "Editar oportunidad" : "Crear oportunidad"}</span>
              <button className="ha-iconbtn" onClick={() => setEditOpportunityOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body" style={{ maxHeight: "calc(85vh - 110px)", overflowY: "auto" }}>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Etapa</label>
                <input className="ha-input" value={ofStage} onChange={(e) => setOfStage(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Valor estimado</label>
                <input type="number" className="ha-input" value={ofEstimatedValue} onChange={(e) => setOfEstimatedValue(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Fecha cierre estimada</label>
                <input type="date" className="ha-input" value={ofExpectedClosingDate} onChange={(e) => setOfExpectedClosingDate(e.target.value)} />
              </div>
              <div className="ha-field">
                <label className="ha-label">Notas</label>
                <textarea className="ha-input" rows={2} value={ofNotes} onChange={(e) => setOfNotes(e.target.value)} style={{ resize: "vertical" }} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setEditOpportunityOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" disabled={submittingOpportunity} onClick={() => void handleUpsertOpportunity()}>
                {submittingOpportunity ? <><Spinner /> Guardando…</> : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Seguimiento */}
      {addInteractionOpen && (
        <div className="ha-modal-backdrop" onClick={() => setAddInteractionOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Registrar seguimiento</span>
              <button className="ha-iconbtn" onClick={() => setAddInteractionOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Medio de contacto</label>
                <select className="ha-input" value={ifChannel} onChange={(e) => setIfChannel(e.target.value as InteractionChannel | "")}>
                  <option value="">Seleccioná un medio</option>
                  {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Fecha y hora</label>
                <input type="datetime-local" className="ha-input" value={ifDate} onChange={(e) => setIfDate(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Resumen / Notas</label>
                <textarea className="ha-input" rows={3} value={ifNotes} onChange={(e) => setIfNotes(e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div className="ha-field">
                <label className="ha-label">Próximo paso</label>
                <input className="ha-input" value={ifNextStep} onChange={(e) => setIfNextStep(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setAddInteractionOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" disabled={submittingInteraction} onClick={() => void handleAddInteraction()}>
                {submittingInteraction ? <><Spinner /> Agregando…</> : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle del pedido */}
      {viewOrderOpen && (
        <div className="ha-modal-backdrop" onClick={() => { setViewOrderOpen(false); setModalOrder(null); }}>
          <div className="ha-modal" style={{ maxWidth: isMobile ? "calc(100vw - 24px)" : "min(1100px, calc(100vw - 280px))", width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Detalle del pedido</span>
              <button className="ha-iconbtn" onClick={() => { setViewOrderOpen(false); setModalOrder(null); }} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body app-panel-scroll" style={{ maxHeight: "calc(85vh - 110px)", overflowY: "auto" }}>
              {modalOrderLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
                </div>
              )}
              {modalOrder && (
                <OrderDetailView
                  key={modalOrder.id}
                  order={modalOrder}
                  onOrderUpdated={(updatedOrder) => {
                    setModalOrder(updatedOrder);
                    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
                  }}
                />
              )}
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--primary" onClick={() => { setViewOrderOpen(false); setModalOrder(null); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CrmAnalysisBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px", color: "#94a3b8", fontSize: 13, marginTop: 12, lineHeight: 1.7 }}>
      {children}
    </div>
  );
}
