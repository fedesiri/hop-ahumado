"use client";

import { apiClient } from "@/lib/api-client";
import type { Dayjs } from "@/lib/dayjs";
import dayjs from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { Order } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { RefreshCw } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

type PeriodPreset = "last3m" | "last12m" | "thisYear" | "all" | "custom";

const PERIOD_SEGS: { value: PeriodPreset; label: string }[] = [
  { value: "last3m", label: "Últimos 3 meses" },
  { value: "last12m", label: "Últimos 12 meses" },
  { value: "thisYear", label: "Este año" },
  { value: "all", label: "Todo el historial" },
  { value: "custom", label: "Personalizado" },
];

function formatMonthEs(monthValue?: string): string {
  if (!monthValue) return "";
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return monthValue;
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function ordersInPreset(
  orders: Order[],
  preset: PeriodPreset,
  customRange: [Dayjs, Dayjs] | null,
): Order[] {
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
        return (
          !t.isBefore(customRange[0].startOf("day")) &&
          !t.isAfter(customRange[1].endOf("day"))
        );
      }
      default:
        return true;
    }
  });
}

function pctChange(b: number, a: number): number | null {
  return a > 0 ? Math.round(((b - a) / a) * 100) : null;
}

function trendClass(pct: number | null): string {
  if (pct === null || pct === 0) return "me-tag me-tag--muted";
  return pct > 0 ? "me-tag me-tag--green" : "me-tag me-tag--red";
}

function trendLabel(pct: number | null): string {
  if (pct === null) return "—";
  return pct >= 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`;
}

export default function OrdersMetricsPage() {
  return <OrdersMetricsContent />;
}

function OrdersMetricsContent() {
  const { selectedLineId } = useLineContext();
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
        const response = await apiClient.getOrders(
          page, limit, undefined, undefined, undefined,
          undefined, undefined, undefined, undefined, undefined, bId,
        );
        all.push(...response.data);
        if (page >= response.meta.totalPages || response.data.length === 0) break;
        page += 1;
      }
      setMetricsOrders(all);
    } catch {
      toast.error("Error al cargar métricas de órdenes");
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

  const previousPeriodOrders = useMemo(() => {
    const now = dayjs();
    switch (periodPreset) {
      case "last3m": {
        const start = now.subtract(5, "month").startOf("month");
        const end = now.subtract(3, "month").endOf("month");
        return metricsOrders.filter((o) => {
          const t = dayjs(o.createdAt);
          return t.isValid() && !t.isBefore(start) && !t.isAfter(end);
        });
      }
      case "last12m": {
        const start = now.subtract(23, "month").startOf("month");
        const end = now.subtract(12, "month").endOf("month");
        return metricsOrders.filter((o) => {
          const t = dayjs(o.createdAt);
          return t.isValid() && !t.isBefore(start) && !t.isAfter(end);
        });
      }
      case "thisYear": {
        const y = now.year() - 1;
        const yearStart = dayjs().year(y).startOf("year");
        const yearEnd = dayjs().year(y).month(now.month()).endOf("month");
        return metricsOrders.filter((o) => {
          const t = dayjs(o.createdAt);
          return t.isValid() && !t.isBefore(yearStart) && !t.isAfter(yearEnd);
        });
      }
      default:
        return [];
    }
  }, [metricsOrders, periodPreset]);

  const metricsTotalAmount = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + Number(o.totalPrice ?? 0), 0),
    [filteredOrders],
  );
  const metricsAvgTicket = useMemo(
    () => (filteredOrders.length > 0 ? metricsTotalAmount / filteredOrders.length : 0),
    [filteredOrders, metricsTotalAmount],
  );

  const kpiTrends = useMemo(() => {
    if (previousPeriodOrders.length === 0) return null;
    const prevTotal = previousPeriodOrders.reduce((s, o) => s + Number(o.totalPrice ?? 0), 0);
    const prevAvg = prevTotal / previousPeriodOrders.length;
    return {
      count: pctChange(filteredOrders.length, previousPeriodOrders.length),
      amount: pctChange(metricsTotalAmount, prevTotal),
      avg: pctChange(metricsAvgTicket, prevAvg),
    };
  }, [previousPeriodOrders, filteredOrders.length, metricsTotalAmount, metricsAvgTicket]);

  const periodRangeLabel = useMemo(() => {
    const now = dayjs();
    switch (periodPreset) {
      case "last3m":
        return `${now.subtract(2, "month").startOf("month").format("MMM YYYY")} – ${now.format("MMM YYYY")}`;
      case "last12m":
        return `${now.subtract(11, "month").startOf("month").format("MMM YYYY")} – ${now.format("MMM YYYY")}`;
      case "thisYear":
        return `Ene ${now.year()} – ${now.format("MMM YYYY")}`;
      case "all":
        return metricsOrders.length > 0 ? "Todo el historial" : "";
      case "custom":
        return customRange
          ? `${customRange[0].format("DD/MM/YY")} – ${customRange[1].format("DD/MM/YY")}`
          : "Seleccioná un rango";
      default:
        return "";
    }
  }, [periodPreset, customRange, metricsOrders.length]);

  const monthlyOrdersSeries = useMemo(() => {
    const map = new Map<string, { month: string; monthSort: string; orders: number }>();
    for (const order of filteredOrders) {
      const d = dayjs(order.createdAt);
      if (!d.isValid()) continue;
      const monthSort = d.format("YYYY-MM");
      const raw = new Date(d.year(), d.month(), 1)
        .toLocaleDateString("es-AR", { month: "short" })
        .replace(".", "");
      const monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1, 3);
      const cur = map.get(monthSort) ?? { month: monthLabel, monthSort, orders: 0 };
      cur.orders += 1;
      map.set(monthSort, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => a.monthSort.localeCompare(b.monthSort))
      .slice(-36);
  }, [filteredOrders]);

  const barChartData = useMemo(() => {
    if (monthlyOrdersSeries.length === 0) return { bars: [], yMax: 0, ySteps: [0, 0, 0] };
    const maxOrders = Math.max(...monthlyOrdersSeries.map((m) => m.orders));
    const yMax = Math.ceil(maxOrders / 5) * 5 || 5;
    const step = yMax / 3;
    return {
      bars: monthlyOrdersSeries.map((m) => ({
        ...m,
        heightPct: `${Math.round((m.orders / yMax) * 100)}%`,
      })),
      yMax,
      ySteps: [yMax, Math.round(yMax - step), Math.round(yMax - 2 * step)],
    };
  }, [monthlyOrdersSeries]);

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

  const topItemsMax = useMemo(
    () => (topItemsSeries.length > 0 ? topItemsSeries[0].units : 1),
    [topItemsSeries],
  );

  const comparisonKpis = useMemo(() => {
    if (!compareMonthA || !compareMonthB) return null;
    const forMonth = (key: string) =>
      metricsOrders.filter((o) => dayjs(o.createdAt).format("YYYY-MM") === key);
    const aOrders = forMonth(compareMonthA);
    const bOrders = forMonth(compareMonthB);
    const aAmt = aOrders.reduce((s, o) => s + Number(o.totalPrice ?? 0), 0);
    const bAmt = bOrders.reduce((s, o) => s + Number(o.totalPrice ?? 0), 0);
    const aAvg = aOrders.length > 0 ? aAmt / aOrders.length : 0;
    const bAvg = bOrders.length > 0 ? bAmt / bOrders.length : 0;
    return {
      aCount: aOrders.length, bCount: bOrders.length,
      aAmt, bAmt, aAvg, bAvg,
      countPct: pctChange(bOrders.length, aOrders.length),
      amtPct: pctChange(bAmt, aAmt),
      avgPct: pctChange(bAvg, aAvg),
    };
  }, [compareMonthA, compareMonthB, metricsOrders]);

  const itemComparisonByMonth = useMemo(() => {
    if (!compareMonthA || !compareMonthB) return [];
    const byMonth = new Map<string, Map<string, number>>();
    const addUnit = (monthKey: string, itemName: string, qty: number) => {
      const inner = byMonth.get(monthKey) ?? new Map<string, number>();
      inner.set(itemName, (inner.get(itemName) ?? 0) + qty);
      byMonth.set(monthKey, inner);
    };
    for (const order of metricsOrders) {
      const monthKey = dayjs(order.createdAt).format("YYYY-MM");
      if (monthKey !== compareMonthA && monthKey !== compareMonthB) continue;
      for (const item of order.orderItems ?? []) {
        addUnit(
          monthKey,
          item.product?.name ?? "Ítem sin nombre",
          Number(item.quantity ?? 0),
        );
      }
    }
    const ma = byMonth.get(compareMonthA) ?? new Map<string, number>();
    const mb = byMonth.get(compareMonthB) ?? new Map<string, number>();
    return [...new Set([...ma.keys(), ...mb.keys()])]
      .map((name) => ({ name, aUnits: ma.get(name) ?? 0, bUnits: mb.get(name) ?? 0 }))
      .sort((x, y) => (y.aUnits + y.bUnits) - (x.aUnits + x.bUnits))
      .slice(0, 10);
  }, [compareMonthA, compareMonthB, metricsOrders]);

  const compareMonthALabel = compareMonthA ? formatMonthEs(compareMonthA) : "Mes base";
  const compareMonthBLabel = compareMonthB ? formatMonthEs(compareMonthB) : "Mes a comparar";

  if (metricsLoading && metricsOrders.length === 0) {
    return <Spinner />;
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <h1 className="me-pagetitle">Métricas de Órdenes</h1>

      {/* Period filter */}
      <div className="me-period">
        <div className="me-segs">
          {PERIOD_SEGS.map((seg) => (
            <button
              key={seg.value}
              className={`me-seg${periodPreset === seg.value ? " is-active" : ""}`}
              onClick={() => setPeriodPreset(seg.value)}
            >
              {seg.label}
            </button>
          ))}
        </div>
        {periodPreset === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 8 }}>
            <input
              type="date"
              className="me-fselect"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ flex: 1 }}
            />
            <span className="me-vs">—</span>
            <input
              type="date"
              className="me-fselect"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        )}
        <span className="me-periodlabel">
          Período: {periodRangeLabel}
          <button
            onClick={() => void fetchAllOrdersForMetrics()}
            disabled={metricsLoading}
            style={{
              background: "transparent", border: "none",
              color: "var(--ha-text-3)", cursor: "pointer", padding: 0,
              display: "inline-flex", alignItems: "center",
            }}
            title="Actualizar datos"
          >
            <RefreshCw
              size={13}
              style={metricsLoading ? { animation: "ha-spin .7s linear infinite" } : {}}
            />
          </button>
        </span>
      </div>

      {/* KPI cards */}
      <div className="me-kpis">
        <div className="me-kpi">
          <div className="me-kpi__val">{filteredOrders.length}</div>
          <div className="me-kpi__label">Órdenes en el período</div>
          {kpiTrends?.count != null && (
            <div className={`me-kpi__trend${(kpiTrends.count ?? 0) < 0 ? " me-kpi__trend--neg" : ""}`}>
              {trendLabel(kpiTrends.count)} vs período anterior
            </div>
          )}
        </div>
        <div className="me-kpi">
          <div className="me-kpi__val">{formatCurrency(metricsTotalAmount)}</div>
          <div className="me-kpi__label">Ingresos en el período</div>
          {kpiTrends?.amount != null && (
            <div className={`me-kpi__trend${(kpiTrends.amount ?? 0) < 0 ? " me-kpi__trend--neg" : ""}`}>
              {trendLabel(kpiTrends.amount)} vs período anterior
            </div>
          )}
        </div>
        <div className="me-kpi">
          <div className="me-kpi__val">{formatCurrency(metricsAvgTicket)}</div>
          <div className="me-kpi__label">Promedio por orden</div>
          {kpiTrends?.avg != null && (
            <div className={`me-kpi__trend${(kpiTrends.avg ?? 0) < 0 ? " me-kpi__trend--neg" : ""}`}>
              {trendLabel(kpiTrends.avg)} vs período anterior
            </div>
          )}
        </div>
      </div>

      {/* Bar chart: órdenes por mes */}
      <div className="me-card">
        <div className="me-card__head">Órdenes por mes</div>
        <div className="me-card__body">
          {barChartData.bars.length === 0 ? (
            <div style={{ color: "var(--ha-text-3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              Sin datos en el período
            </div>
          ) : (
            <>
              <div className="me-chart">
                <div className="me-yaxis">
                  <div className="me-ylabel" style={{ top: "0%" }}>{barChartData.yMax}</div>
                  <div className="me-ylabel" style={{ top: "33.3%" }}>{barChartData.ySteps[1]}</div>
                  <div className="me-ylabel" style={{ top: "66.6%" }}>{barChartData.ySteps[2]}</div>
                  <div className="me-ylabel" style={{ top: "100%" }}>0</div>
                </div>
                <div className="me-yline" style={{ top: "0%" }} />
                <div className="me-yline" style={{ top: "33.3%" }} />
                <div className="me-yline" style={{ top: "66.6%" }} />
                <div className="me-yline" style={{ bottom: 22 }} />
                {barChartData.bars.map((b) => (
                  <div key={b.monthSort} className="me-bar">
                    <div className="me-bar__tip">{b.orders} órdenes</div>
                    <div className="me-bar__fill" style={{ height: b.heightPct }} />
                    <div className="me-bar__lab">{b.month}</div>
                  </div>
                ))}
              </div>
              <div className="me-legend">Cada barra representa el total de órdenes creadas en ese mes.</div>
            </>
          )}
        </div>
      </div>

      {/* Top 10 products */}
      <div className="me-card">
        <div className="me-card__head">Top 10 productos por unidades vendidas</div>
        {topItemsSeries.length === 0 ? (
          <div style={{ padding: "20px", color: "var(--ha-text-3)", fontSize: 13 }}>
            Sin datos en el período
          </div>
        ) : (
          <table className="me-toptable">
            <tbody>
              {topItemsSeries.map((item, i) => (
                <tr key={item.name}>
                  <td className="me-rankcol" style={{ width: 46, paddingRight: 0 }}>
                    <span className={`me-rank${i === 0 ? " is-1" : ""}`}>{i + 1}</span>
                  </td>
                  <td className="me-topname">{item.name}</td>
                  <td className="me-partcell">
                    <div className="me-partbar">
                      <div
                        className="me-partbar__f"
                        style={{ width: `${Math.round((item.units / topItemsMax) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="me-topu">{item.units} un</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Month comparison */}
      <div className="me-card" style={{ marginBottom: 0 }}>
        <div className="me-card__head">Comparar meses</div>
        <div className="me-cmp-sel">
          <select
            className="me-fselect"
            value={compareMonthA ?? ""}
            onChange={(e) => setCompareMonthA(e.target.value || undefined)}
          >
            <option value="">Mes base</option>
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="me-vs">vs.</span>
          <select
            className="me-fselect"
            value={compareMonthB ?? ""}
            onChange={(e) => setCompareMonthB(e.target.value || undefined)}
          >
            <option value="">Mes a comparar</option>
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {comparisonKpis && (
          <>
            <div className="me-cmp-cols">
              <div className="me-cmpcol">
                <div className="me-cmpcol__h">{compareMonthALabel}</div>
                <div className="me-cmprow">
                  <span className="me-cmprow__l">Órdenes</span>
                  <span className="me-cmprow__v">{comparisonKpis.aCount}</span>
                </div>
                <div className="me-cmprow">
                  <span className="me-cmprow__l">Facturación</span>
                  <span className="me-cmprow__v">{formatCurrency(comparisonKpis.aAmt)}</span>
                </div>
                <div className="me-cmprow">
                  <span className="me-cmprow__l">Ticket promedio</span>
                  <span className="me-cmprow__v">{formatCurrency(comparisonKpis.aAvg)}</span>
                </div>
              </div>
              <div className="me-cmpcol">
                <div className="me-cmpcol__h">{compareMonthBLabel}</div>
                <div className="me-cmprow">
                  <span className="me-cmprow__l">Órdenes</span>
                  <span className="me-cmprow__v">
                    {comparisonKpis.bCount}
                    {comparisonKpis.countPct != null && (
                      <span className={trendClass(comparisonKpis.countPct)}>
                        {trendLabel(comparisonKpis.countPct)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="me-cmprow">
                  <span className="me-cmprow__l">Facturación</span>
                  <span className="me-cmprow__v">
                    {formatCurrency(comparisonKpis.bAmt)}
                    {comparisonKpis.amtPct != null && (
                      <span className={trendClass(comparisonKpis.amtPct)}>
                        {trendLabel(comparisonKpis.amtPct)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="me-cmprow">
                  <span className="me-cmprow__l">Ticket promedio</span>
                  <span className="me-cmprow__v">
                    {formatCurrency(comparisonKpis.bAvg)}
                    {comparisonKpis.avgPct != null && (
                      <span className={trendClass(comparisonKpis.avgPct)}>
                        {trendLabel(comparisonKpis.avgPct)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {itemComparisonByMonth.length > 0 && (
              <table className="me-cmptable">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="r">{compareMonthALabel.split(" ")[0]}</th>
                    <th className="r">{compareMonthBLabel.split(" ")[0]}</th>
                    <th className="r">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {itemComparisonByMonth.map((row) => {
                    const delta = pctChange(row.bUnits, row.aUnits);
                    return (
                      <tr key={row.name}>
                        <td className="nm">{row.name}</td>
                        <td className="r num">{row.aUnits}</td>
                        <td className="r num">{row.bUnits}</td>
                        <td className="r">
                          <span className={trendClass(delta)}>{trendLabel(delta)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
