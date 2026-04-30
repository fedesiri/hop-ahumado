"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import type { Dayjs } from "@/lib/dayjs";
import dayjs from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { Order } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { App, Button, Card, DatePicker, Select, Space, Spin } from "antd";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type PeriodPreset = "all" | "last3m" | "last12m" | "thisYear" | "custom";

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "Todo el período cargado" },
  { value: "last3m", label: "Últimos 3 meses" },
  { value: "last12m", label: "Últimos 12 meses" },
  { value: "thisYear", label: "Año actual" },
  { value: "custom", label: "Rango libre…" },
];

function formatMonthEs(monthValue?: string): string {
  if (!monthValue) return "";
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return monthValue;
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function ordersInPreset(orders: Order[], preset: PeriodPreset, customRange: [Dayjs, Dayjs] | null): Order[] {
  const now = dayjs();
  return orders.filter((order) => {
    const t = dayjs(order.createdAt);
    if (!t.isValid()) return false;
    switch (preset) {
      case "all":
        return true;
      case "last3m":
        return !t.isBefore(now.subtract(2, "month").startOf("month"));
      case "last12m":
        return !t.isBefore(now.subtract(11, "month").startOf("month"));
      case "thisYear":
        return !t.isBefore(now.startOf("year"));
      case "custom": {
        if (!customRange?.[0] || !customRange?.[1]) return true;
        return !t.isBefore(customRange[0].startOf("day")) && !t.isAfter(customRange[1].endOf("day"));
      }
      default:
        return true;
    }
  });
}

export default function OrdersMetricsPage() {
  return (
    <LineProvider>
      <AppLayout>
        <OrdersMetricsContent />
      </AppLayout>
    </LineProvider>
  );
}

function OrdersMetricsContent() {
  const { message } = App.useApp();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [metricsOrders, setMetricsOrders] = useState<Order[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("last12m");
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [compareMonthA, setCompareMonthA] = useState<string | undefined>(undefined);
  const [compareMonthB, setCompareMonthB] = useState<string | undefined>(undefined);

  const fetchAllOrdersForMetrics = async () => {
    try {
      setMetricsLoading(true);
      const all: Order[] = [];
      let page = 1;
      const limit = 100;
      while (true) {
        const response = await apiClient.getOrders(page, limit);
        all.push(...response.data);
        if (page >= response.meta.totalPages || response.data.length === 0) break;
        page += 1;
      }
      setMetricsOrders(all);
    } catch (error) {
      message.error("Error al cargar métricas globales de órdenes");
      console.error(error);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllOrdersForMetrics();
  }, []);

  const monthOptions = useMemo(() => {
    const uniq = new Set<string>();
    for (const order of metricsOrders) {
      const parsed = dayjs(order.createdAt);
      if (!parsed.isValid()) continue;
      uniq.add(parsed.format("YYYY-MM"));
    }
    return Array.from(uniq)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: formatMonthEs(value) }));
  }, [metricsOrders]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      setCompareMonthA(undefined);
      setCompareMonthB(undefined);
      return;
    }
    setCompareMonthA((prev) => prev ?? monthOptions[0]?.value);
    setCompareMonthB((prev) => prev ?? monthOptions[1]?.value ?? monthOptions[0]?.value);
  }, [monthOptions]);

  const filteredOrders = useMemo(
    () => ordersInPreset(metricsOrders, periodPreset, customRange),
    [metricsOrders, periodPreset, customRange],
  );

  const periodLabel =
    PERIOD_OPTIONS.find((o) => o.value === periodPreset)?.label ??
    (periodPreset === "custom" && customRange
      ? `${customRange[0].format("DD/MM/YY")} – ${customRange[1].format("DD/MM/YY")}`
      : "");

  const metricsTotalAmount = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + Number(order.totalPrice ?? 0), 0),
    [filteredOrders],
  );
  const metricsAvgTicket = useMemo(
    () => (filteredOrders.length > 0 ? metricsTotalAmount / filteredOrders.length : 0),
    [filteredOrders, metricsTotalAmount],
  );

  const monthlyOrdersSeries = useMemo(() => {
    const map = new Map<string, { month: string; monthSort: string; orders: number }>();
    const MAX_MONTHS = 36;
    for (const order of filteredOrders) {
      const d = dayjs(order.createdAt);
      if (!d.isValid()) continue;
      const monthSort = d.format("YYYY-MM");
      const monthLabel = new Date(d.year(), d.month(), 1).toLocaleDateString("es-AR", {
        month: "short",
        year: "2-digit",
      });
      const cur = map.get(monthSort) ?? { month: monthLabel, monthSort, orders: 0 };
      cur.orders += 1;
      map.set(monthSort, cur);
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.monthSort.localeCompare(b.monthSort));
    return sorted.slice(-Math.min(sorted.length, MAX_MONTHS));
  }, [filteredOrders]);

  const topItemsSeries = useMemo(() => {
    const unitsByName = new Map<string, number>();
    for (const order of filteredOrders) {
      for (const item of order.orderItems ?? []) {
        const name = item.product?.name ?? "Ítem sin nombre";
        unitsByName.set(name, (unitsByName.get(name) ?? 0) + Number(item.quantity ?? 0));
      }
    }
    return Array.from(unitsByName.entries())
      .map(([name, units]) => ({ name, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 10);
  }, [filteredOrders]);

  const comparisonKpis = useMemo(() => {
    if (!compareMonthA || !compareMonthB) return null;
    const countMonth = (key: string) =>
      metricsOrders.filter((order) => dayjs(order.createdAt).format("YYYY-MM") === key).length;
    const amountMonth = (key: string) =>
      metricsOrders
        .filter((order) => dayjs(order.createdAt).format("YYYY-MM") === key)
        .reduce((s, o) => s + Number(o.totalPrice ?? 0), 0);
    const aCount = countMonth(compareMonthA);
    const bCount = countMonth(compareMonthB);
    const aAmt = amountMonth(compareMonthA);
    const bAmt = amountMonth(compareMonthB);
    return { aCount, bCount, deltaCount: aCount - bCount, aAmt, bAmt, deltaAmt: aAmt - bAmt };
  }, [compareMonthA, compareMonthB, metricsOrders]);

  const itemComparisonByMonth = useMemo(() => {
    if (!compareMonthA || !compareMonthB) return [];
    const byMonthLine = new Map<string, Map<string, number>>();
    const addUnit = (monthKey: string, itemName: string, qty: number) => {
      const inner = byMonthLine.get(monthKey) ?? new Map<string, number>();
      inner.set(itemName, (inner.get(itemName) ?? 0) + qty);
      byMonthLine.set(monthKey, inner);
    };
    for (const order of metricsOrders) {
      const monthKey = dayjs(order.createdAt).format("YYYY-MM");
      if (monthKey !== compareMonthA && monthKey !== compareMonthB) continue;
      for (const item of order.orderItems ?? []) {
        addUnit(monthKey, item.product?.name ?? "Ítem sin nombre", Number(item.quantity ?? 0));
      }
    }
    const ma = byMonthLine.get(compareMonthA) ?? new Map();
    const mb = byMonthLine.get(compareMonthB) ?? new Map();
    const names = [...new Set([...ma.keys(), ...mb.keys()])]
      .map((name) => ({ name, sum: (ma.get(name) ?? 0) + (mb.get(name) ?? 0) }))
      .sort((x, y) => y.sum - x.sum)
      .slice(0, 10)
      .map((row) => row.name);
    return names.map((name) => ({
      name,
      monthAUnits: ma.get(name) ?? 0,
      monthBUnits: mb.get(name) ?? 0,
    }));
  }, [compareMonthA, compareMonthB, metricsOrders]);

  const compareMonthALabel = compareMonthA ? formatMonthEs(compareMonthA) : "Mes A";
  const compareMonthBLabel = compareMonthB ? formatMonthEs(compareMonthB) : "Mes B";

  const globalItemsBarMinWidthPx = useMemo(() => {
    if (!isMobile || topItemsSeries.length === 0) return null as number | null;
    const longest = topItemsSeries.reduce((m, r) => Math.max(m, r.name?.length ?? 0), 8);
    return Math.min(780, Math.max(300, longest * 6.5 + 200));
  }, [isMobile, topItemsSeries]);

  const globalItemsYAxisWidth = useMemo(() => {
    const longest = topItemsSeries.reduce((m, r) => Math.max(m, r.name?.length ?? 0), 8);
    if (!isMobile) return Math.min(200, longest * 5.5 + 24);
    return Math.min(300, Math.max(120, longest * 6));
  }, [isMobile, topItemsSeries]);

  const globalMonthlyMinWidthPx = useMemo(() => {
    if (!isMobile || monthlyOrdersSeries.length === 0) return null as number | null;
    return Math.min(980, Math.max(300, monthlyOrdersSeries.length * 52 + 40));
  }, [isMobile, monthlyOrdersSeries]);

  const globalComparisonMinWidthPx = useMemo(() => {
    if (!isMobile || itemComparisonByMonth.length === 0) return null as number | null;
    const n = itemComparisonByMonth.length;
    const longest = itemComparisonByMonth.reduce((m, r) => Math.max(m, r.name?.length ?? 0), 6);
    return Math.min(900, Math.max(320, n * 64 + longest * 4 + 40));
  }, [isMobile, itemComparisonByMonth]);

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          gap: 12,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <h1 style={{ margin: 0, color: "#ffffff" }}>Órdenes — Métricas</h1>
        <Space
          wrap={!isMobile}
          direction={isMobile ? "vertical" : "horizontal"}
          style={isMobile ? { width: "100%" } : undefined}
        >
          <Link href="/orders" style={isMobile ? { width: "100%" } : undefined}>
            <Button block={isMobile}>Ir al listado</Button>
          </Link>
          <Link href="/orders/calculator" style={isMobile ? { width: "100%" } : undefined}>
            <Button type="primary" block={isMobile}>
              Nueva orden
            </Button>
          </Link>
          <Button onClick={() => void fetchAllOrdersForMetrics()} loading={metricsLoading} block={isMobile}>
            Actualizar datos
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16, background: "#1f2937", borderColor: "#2d3748" }}>
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            Los KPIs y los tres primeros gráficos usan el{" "}
            <strong style={{ color: "#e5e7eb" }}>período seleccionado</strong>. La comparación de meses abajo usa el
            historial cargado ({metricsOrders.length} órdenes).
          </div>
          <Space wrap style={{ width: "100%" }}>
            <Select
              value={periodPreset}
              style={{ width: isMobile ? "100%" : 280 }}
              options={PERIOD_OPTIONS}
              onChange={(value) => {
                setPeriodPreset(value as PeriodPreset);
              }}
            />
            {periodPreset === "custom" ? (
              <DatePicker.RangePicker
                style={{ width: isMobile ? "100%" : undefined }}
                value={customRange as any}
                format="DD/MM/YYYY"
                onChange={(v) => setCustomRange(v as [Dayjs, Dayjs] | null)}
              />
            ) : null}
          </Space>
        </Space>
      </Card>

      <Spin spinning={metricsLoading && metricsOrders.length === 0}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card style={{ background: "#1f2937", borderColor: "#2d3748" }}>
            <Space size={24} wrap direction={isMobile ? "vertical" : "horizontal"}>
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Período</div>
                <div style={{ color: "#e5e7eb", fontSize: 13 }}>{periodLabel}</div>
              </div>
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Órdenes</div>
                <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>{filteredOrders.length}</div>
              </div>
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Facturación</div>
                <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>
                  {formatCurrency(metricsTotalAmount)}
                </div>
              </div>
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Ticket promedio</div>
                <div style={{ color: "#fafafa", fontSize: 24, fontWeight: 600 }}>
                  {formatCurrency(metricsAvgTicket)}
                </div>
              </div>
            </Space>
          </Card>

          <Card title={`Pedidos por mes (período: ${periodLabel})`}>
            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 240 : 280, minWidth: globalMonthlyMinWidthPx ?? "100%" }}>
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
                    <Bar dataKey="orders" name="Pedidos" fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card title="Ítems más pedidos (unidades), período seleccionado">
            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 280 : 320, minWidth: globalItemsBarMinWidthPx ?? "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItemsSeries} layout="vertical" margin={{ left: isMobile ? 12 : 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#9ca3af" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#9ca3af"
                      width={globalItemsYAxisWidth}
                      interval={0}
                      tick={{ fill: "#9ca3af", fontSize: isMobile ? 11 : 12 }}
                    />
                    <Tooltip />
                    <Bar dataKey="units" name="Unidades" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card title="Comparar dos meses (unidades por ítem)">
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Space wrap style={{ width: "100%" }}>
                <Select
                  placeholder="Mes 1"
                  style={{ width: isMobile ? "100%" : 220 }}
                  value={compareMonthA}
                  options={monthOptions}
                  onChange={setCompareMonthA}
                  showSearch
                  optionFilterProp="label"
                />
                <Select
                  placeholder="Mes 2"
                  style={{ width: isMobile ? "100%" : 220 }}
                  value={compareMonthB}
                  options={monthOptions}
                  onChange={setCompareMonthB}
                  showSearch
                  optionFilterProp="label"
                />
              </Space>
              {comparisonKpis ? (
                <Space direction="vertical" size={8} style={{ color: "#9ca3af" }}>
                  <div>
                    <strong style={{ color: "#fafafa" }}>{compareMonthALabel}</strong>: {comparisonKpis.aCount} pedidos
                    · {formatCurrency(comparisonKpis.aAmt)}
                  </div>
                  <div>
                    <strong style={{ color: "#fafafa" }}>{compareMonthBLabel}</strong>: {comparisonKpis.bCount} pedidos
                    · {formatCurrency(comparisonKpis.bAmt)}
                  </div>
                  <div style={{ color: comparisonKpis.deltaCount >= 0 ? "#22c55e" : "#f87171" }}>
                    Δ pedidos: {comparisonKpis.deltaCount >= 0 ? "+" : ""}
                    {comparisonKpis.deltaCount}
                  </div>
                  <div style={{ color: comparisonKpis.deltaAmt >= 0 ? "#22c55e" : "#f87171" }}>
                    Δ facturación: {comparisonKpis.deltaAmt >= 0 ? "+" : ""}
                    {formatCurrency(comparisonKpis.deltaAmt)}
                  </div>
                </Space>
              ) : null}
              <div
                style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}
              >
                <div style={{ height: isMobile ? 300 : 320, minWidth: globalComparisonMinWidthPx ?? "100%" }}>
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
                      <Bar dataKey="monthAUnits" name={compareMonthALabel} fill="#60a5fa" />
                      <Bar dataKey="monthBUnits" name={compareMonthBLabel} fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Space>
          </Card>
        </Space>
      </Spin>
    </div>
  );
}
