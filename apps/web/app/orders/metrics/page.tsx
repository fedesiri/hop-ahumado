"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import type { Dayjs } from "@/lib/dayjs";
import dayjs from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { Order } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
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
    <AppLayout>
      <OrdersMetricsContent />
    </AppLayout>
  );
}

function OrdersMetricsContent() {
  const { selectedLineId } = useLineContext();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [metricsOrders, setMetricsOrders] = useState<Order[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("last12m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [compareMonthA, setCompareMonthA] = useState<string | undefined>(undefined);
  const [compareMonthB, setCompareMonthB] = useState<string | undefined>(undefined);

  const customRange: [Dayjs, Dayjs] | null = useMemo(() => {
    if (!customFrom || !customTo) return null;
    const a = dayjs(customFrom);
    const b = dayjs(customTo);
    return a.isValid() && b.isValid() ? [a, b] : null;
  }, [customFrom, customTo]);

  const fetchAllOrdersForMetrics = async () => {
    try {
      setMetricsLoading(true);
      const all: Order[] = [];
      let page = 1;
      const limit = 100;
      const bId = selectedLineId ?? undefined;
      while (true) {
        const response = await apiClient.getOrders(page, limit, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, bId);
        all.push(...response.data);
        if (page >= response.meta.totalPages || response.data.length === 0) break;
        page += 1;
      }
      setMetricsOrders(all);
    } catch {
      toast.error("Error al cargar métricas globales de órdenes");
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllOrdersForMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLineId]);

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

  const kpiAnalysis = useMemo(() => {
    if (filteredOrders.length === 0) return null;
    return `${filteredOrders.length} orden${filteredOrders.length !== 1 ? "es" : ""} en el período, con una facturación total de ${formatCurrency(metricsTotalAmount)} y un ticket promedio de ${formatCurrency(metricsAvgTicket)}.`;
  }, [filteredOrders.length, metricsTotalAmount, metricsAvgTicket]);

  const monthlyAnalysis = useMemo(() => {
    if (monthlyOrdersSeries.length === 0) return null;
    const sorted = [...monthlyOrdersSeries].sort((a, b) => b.orders - a.orders);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const last3 = monthlyOrdersSeries.slice(-3);
    const prev3 = monthlyOrdersSeries.slice(-6, -3);
    let trend = "";
    if (last3.length === 3 && prev3.length >= 2) {
      const lastAvg = last3.reduce((s, m) => s + m.orders, 0) / 3;
      const prevAvg = prev3.reduce((s, m) => s + m.orders, 0) / prev3.length;
      if (lastAvg > prevAvg * 1.1) trend = "La tendencia de los últimos 3 meses es al alza.";
      else if (lastAvg < prevAvg * 0.9) trend = "La tendencia de los últimos 3 meses es a la baja.";
      else trend = "La tendencia de los últimos 3 meses es estable.";
    }
    return { best, worst, trend };
  }, [monthlyOrdersSeries]);

  const topItemsAnalysis = useMemo(() => {
    if (topItemsSeries.length === 0) return null;
    const total = topItemsSeries.reduce((s, i) => s + i.units, 0);
    const top3Total = topItemsSeries.slice(0, 3).reduce((s, i) => s + i.units, 0);
    const top3Pct = total > 0 ? Math.round((top3Total / total) * 100) : 0;
    return { top: topItemsSeries[0], top3Pct, total };
  }, [topItemsSeries]);

  const comparisonAnalysis = useMemo(() => {
    if (!comparisonKpis || itemComparisonByMonth.length === 0) return null;
    const grew = [...itemComparisonByMonth].sort(
      (a, b) => b.monthAUnits - b.monthBUnits - (a.monthAUnits - a.monthBUnits),
    )[0];
    const fell = [...itemComparisonByMonth].sort(
      (a, b) => a.monthAUnits - a.monthBUnits - (b.monthAUnits - b.monthBUnits),
    )[0];
    const pctCount =
      comparisonKpis.bCount > 0
        ? Math.round(((comparisonKpis.aCount - comparisonKpis.bCount) / comparisonKpis.bCount) * 100)
        : null;
    const pctAmt =
      comparisonKpis.bAmt > 0
        ? Math.round(((comparisonKpis.aAmt - comparisonKpis.bAmt) / comparisonKpis.bAmt) * 100)
        : null;
    return { grew, fell, pctCount, pctAmt };
  }, [comparisonKpis, itemComparisonByMonth]);

  const cardStyle: React.CSSProperties = {
    background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)",
    borderRadius: 12, padding: "20px 24px", marginBottom: 16,
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Órdenes — Métricas</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/orders"><button className="ha-btn ha-btn--secondary ha-btn--sm">Ir al listado</button></Link>
          <Link href="/orders/calculator"><button className="ha-btn ha-btn--primary ha-btn--sm">Nueva orden</button></Link>
          <button
            className="ha-btn ha-btn--secondary ha-btn--sm"
            onClick={() => void fetchAllOrdersForMetrics()}
            disabled={metricsLoading}
          >
            {metricsLoading ? "Cargando…" : "Actualizar datos"}
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ color: "var(--ha-text-2)", fontSize: 13, marginBottom: 12 }}>
          Los KPIs y los tres primeros gráficos usan el{" "}
          <strong style={{ color: "var(--ha-text)" }}>período seleccionado</strong>. La comparación de meses abajo usa el
          historial cargado ({metricsOrders.length} órdenes).
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <select
            className="ha-select"
            style={{ height: 36, padding: "0 12px", minWidth: 220, borderRadius: 8, border: "1px solid var(--ha-border-2)", background: "var(--ha-bg-raised)", color: "var(--ha-text)", fontSize: 13 }}
            value={periodPreset}
            onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
          >
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {periodPreset === "custom" && (
            <>
              <input
                type="date"
                className="ha-input"
                style={{ height: 36, width: "auto", padding: "0 10px" }}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span style={{ color: "var(--ha-text-3)" }}>—</span>
              <input
                type="date"
                className="ha-input"
                style={{ height: 36, width: "auto", padding: "0 10px" }}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {metricsLoading && metricsOrders.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPI summary */}
          <div style={cardStyle}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              <div>
                <div style={{ color: "var(--ha-text-3)", fontSize: 12 }}>Período</div>
                <div style={{ color: "var(--ha-text-2)", fontSize: 13 }}>{periodLabel}</div>
              </div>
              <div>
                <div style={{ color: "var(--ha-text-3)", fontSize: 12 }}>Órdenes</div>
                <div className="ha-mono" style={{ color: "var(--ha-text)", fontSize: 24, fontWeight: 600 }}>{filteredOrders.length}</div>
              </div>
              <div>
                <div style={{ color: "var(--ha-text-3)", fontSize: 12 }}>Facturación</div>
                <div className="ha-mono" style={{ color: "var(--ha-text)", fontSize: 24, fontWeight: 600 }}>{formatCurrency(metricsTotalAmount)}</div>
              </div>
              <div>
                <div style={{ color: "var(--ha-text-3)", fontSize: 12 }}>Ticket promedio</div>
                <div className="ha-mono" style={{ color: "var(--ha-text)", fontSize: 24, fontWeight: 600 }}>{formatCurrency(metricsAvgTicket)}</div>
              </div>
            </div>
            {kpiAnalysis && <AnalysisBlock>{kpiAnalysis}</AnalysisBlock>}
          </div>

          {/* Monthly orders chart */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Pedidos por mes (período: {periodLabel})</div>
            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 240 : 280, minWidth: globalMonthlyMinWidthPx ?? "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyOrdersSeries} margin={{ bottom: isMobile ? 16 : 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ha-border)" />
                    <XAxis dataKey="month" stroke="var(--ha-text-3)" tick={{ fill: "var(--ha-text-3)", fontSize: isMobile ? 10 : 12 }} interval={isMobile ? 0 : undefined} />
                    <YAxis stroke="var(--ha-text-3)" allowDecimals={false} tick={{ fill: "var(--ha-text-3)", fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="orders" name="Pedidos" fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {monthlyAnalysis && (
              <AnalysisBlock>
                El mes con más pedidos fue <strong>{monthlyAnalysis.best.month}</strong> con{" "}
                <strong>{monthlyAnalysis.best.orders}</strong> órdenes. El mes con menos actividad fue{" "}
                <strong>{monthlyAnalysis.worst.month}</strong> con{" "}
                <strong>{monthlyAnalysis.worst.orders}</strong> orden{monthlyAnalysis.worst.orders !== 1 ? "es" : ""}.
                {monthlyAnalysis.trend ? ` ${monthlyAnalysis.trend}` : ""}
              </AnalysisBlock>
            )}
          </div>

          {/* Top items chart */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Ítems más pedidos (unidades), período seleccionado</div>
            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 280 : 320, minWidth: globalItemsBarMinWidthPx ?? "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItemsSeries} layout="vertical" margin={{ left: isMobile ? 12 : 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ha-border)" />
                    <XAxis type="number" stroke="var(--ha-text-3)" allowDecimals={false} tick={{ fill: "var(--ha-text-3)", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="var(--ha-text-3)" width={globalItemsYAxisWidth} interval={0} tick={{ fill: "var(--ha-text-3)", fontSize: isMobile ? 11 : 12 }} />
                    <Tooltip />
                    <Bar dataKey="units" name="Unidades" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {topItemsAnalysis && (
              <AnalysisBlock>
                El producto más demandado es <strong>{topItemsAnalysis.top.name}</strong> con{" "}
                <strong>{topItemsAnalysis.top.units}</strong> unidades.
                {topItemsSeries.length >= 3
                  ? ` Los 3 primeros productos concentran el ${topItemsAnalysis.top3Pct}% del total de unidades pedidas.`
                  : ""}
              </AnalysisBlock>
            )}
          </div>

          {/* Month comparison */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Comparar dos meses (unidades por ítem)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <select
                className="ha-select"
                style={{ height: 36, padding: "0 12px", minWidth: 200, borderRadius: 8, border: "1px solid var(--ha-border-2)", background: "var(--ha-bg-raised)", color: "var(--ha-text)", fontSize: 13 }}
                value={compareMonthA ?? ""}
                onChange={(e) => setCompareMonthA(e.target.value || undefined)}
              >
                <option value="">Mes 1</option>
                {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                className="ha-select"
                style={{ height: 36, padding: "0 12px", minWidth: 200, borderRadius: 8, border: "1px solid var(--ha-border-2)", background: "var(--ha-bg-raised)", color: "var(--ha-text)", fontSize: 13 }}
                value={compareMonthB ?? ""}
                onChange={(e) => setCompareMonthB(e.target.value || undefined)}
              >
                <option value="">Mes 2</option>
                {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {comparisonKpis && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--ha-text-2)", marginBottom: 16 }}>
                <div><strong style={{ color: "var(--ha-text)" }}>{compareMonthALabel}</strong>: {comparisonKpis.aCount} pedidos · {formatCurrency(comparisonKpis.aAmt)}</div>
                <div><strong style={{ color: "var(--ha-text)" }}>{compareMonthBLabel}</strong>: {comparisonKpis.bCount} pedidos · {formatCurrency(comparisonKpis.bAmt)}</div>
                <div style={{ color: comparisonKpis.deltaCount >= 0 ? "var(--ha-green)" : "var(--ha-red)" }}>
                  Δ pedidos: {comparisonKpis.deltaCount >= 0 ? "+" : ""}{comparisonKpis.deltaCount}
                  {comparisonAnalysis?.pctCount != null ? ` (${comparisonAnalysis.pctCount >= 0 ? "+" : ""}${comparisonAnalysis.pctCount}%)` : ""}
                </div>
                <div style={{ color: comparisonKpis.deltaAmt >= 0 ? "var(--ha-green)" : "var(--ha-red)" }}>
                  Δ facturación: {comparisonKpis.deltaAmt >= 0 ? "+" : ""}{formatCurrency(comparisonKpis.deltaAmt)}
                  {comparisonAnalysis?.pctAmt != null ? ` (${comparisonAnalysis.pctAmt >= 0 ? "+" : ""}${comparisonAnalysis.pctAmt}%)` : ""}
                </div>
              </div>
            )}

            <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch", width: "100%" }}>
              <div style={{ height: isMobile ? 300 : 320, minWidth: globalComparisonMinWidthPx ?? "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemComparisonByMonth} margin={{ left: 4, right: 8, top: 8, bottom: isMobile ? 112 : 64 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ha-border)" />
                    <XAxis dataKey="name" stroke="var(--ha-text-3)" interval={0} angle={isMobile ? -42 : -20} textAnchor="end" height={isMobile ? 110 : 72} tick={{ fill: "var(--ha-text-3)", fontSize: isMobile ? 9 : 12 }} />
                    <YAxis stroke="var(--ha-text-3)" allowDecimals={false} tick={{ fill: "var(--ha-text-3)", fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 11 : undefined }} />
                    <Bar dataKey="monthAUnits" name={compareMonthALabel} fill="#60a5fa" />
                    <Bar dataKey="monthBUnits" name={compareMonthBLabel} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {comparisonAnalysis && (
              <AnalysisBlock>
                {comparisonKpis && comparisonKpis.deltaCount !== 0 ? (
                  <>
                    <strong>{compareMonthALabel}</strong>{" "}
                    {comparisonKpis.deltaCount > 0 ? "superó" : "estuvo por debajo de"}{" "}
                    <strong>{compareMonthBLabel}</strong> en pedidos
                    {comparisonAnalysis.pctCount != null ? ` (${comparisonAnalysis.pctCount >= 0 ? "+" : ""}${comparisonAnalysis.pctCount}%)` : ""}.{" "}
                  </>
                ) : null}
                {comparisonAnalysis.grew && comparisonAnalysis.grew.monthAUnits > comparisonAnalysis.grew.monthBUnits ? (
                  <>
                    El producto con mayor crecimiento fue <strong>{comparisonAnalysis.grew.name}</strong> (
                    {comparisonAnalysis.grew.monthBUnits} → {comparisonAnalysis.grew.monthAUnits} un.).{" "}
                  </>
                ) : null}
                {comparisonAnalysis.fell && comparisonAnalysis.fell.monthBUnits > comparisonAnalysis.fell.monthAUnits ? (
                  <>
                    El que más cayó fue <strong>{comparisonAnalysis.fell.name}</strong> (
                    {comparisonAnalysis.fell.monthBUnits} → {comparisonAnalysis.fell.monthAUnits} un.).
                  </>
                ) : null}
              </AnalysisBlock>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--ha-bg-raised)",
      border: "1px solid var(--ha-border)",
      borderRadius: 8,
      padding: "10px 14px",
      color: "var(--ha-text-2)",
      fontSize: 13,
      marginTop: 12,
      lineHeight: 1.7,
    }}>
      {children}
    </div>
  );
}
