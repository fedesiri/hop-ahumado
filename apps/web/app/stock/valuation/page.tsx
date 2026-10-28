"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { StockValuationMixMode, StockValuationResponse, StockValuationRow } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { useEffect, useMemo, useState } from "react";

const QUICK_RANGES = [
  { label: "Hace 7 días", days: 7 },
  { label: "Hace 30 días", days: 30 },
  { label: "Hace 90 días", days: 90 },
];

function toInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toInputDate(d);
}

function formatPct(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  const pct = previous > 0 ? (diff / previous) * 100 : null;
  const up = diff >= 0;
  return (
    <span className={"ha-stat__badge " + (up ? "ha-stat__badge--up" : "ha-stat__badge--down")}>
      {up ? "▲" : "▼"} {formatCurrency(Math.abs(diff))}
      {pct != null && ` (${Math.abs(pct).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)`}
    </span>
  );
}

export default function StockValuationPage() {
  return <StockValuationContent />;
}

function StockValuationContent() {
  const { selectedLineId } = useLineContext();
  const [compareDate, setCompareDate] = useState("");
  const [mixMode, setMixMode] = useState<StockValuationMixMode>("product");
  const [current, setCurrent] = useState<StockValuationResponse | null>(null);
  const [previous, setPrevious] = useState<StockValuationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedLineId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiClient.getStockValuation(selectedLineId, undefined, mixMode),
      compareDate ? apiClient.getStockValuation(selectedLineId, compareDate, mixMode) : Promise.resolve(null),
    ])
      .then(([cur, prev]) => {
        if (cancelled) return;
        setCurrent(cur);
        setPrevious(prev);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("No se pudo calcular la valorización del stock");
        setCurrent(null);
        setPrevious(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLineId, compareDate, mixMode]);

  const rows = useMemo(() => {
    const byId = new Map<string, { name: string; cur?: StockValuationRow; prev?: StockValuationRow }>();
    for (const r of current?.rows ?? []) byId.set(r.productId, { name: r.name, cur: r });
    for (const r of previous?.rows ?? []) {
      const entry = byId.get(r.productId);
      if (entry) entry.prev = r;
      else byId.set(r.productId, { name: r.name, prev: r });
    }
    return [...byId.entries()]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [current, previous]);

  const comparing = previous != null;
  const cards: { label: string; sub: string; cur: number | null; prev: number | null; highlight?: boolean }[] = current
    ? [
        { label: "A precio fábrica", sub: "Lista fábrica", cur: current.totals.factory, prev: previous?.totals.factory ?? null },
        { label: "A precio minorista", sub: "Si todo se vendiera minorista", cur: current.totals.retail, prev: previous?.totals.retail ?? null },
        { label: "A precio mayorista", sub: "Si todo se vendiera mayorista", cur: current.totals.wholesale, prev: previous?.totals.wholesale ?? null },
        {
          label: "Valor esperado de venta",
          sub: `Mix histórico ${mixMode === "global" ? "global" : "por producto"}`,
          cur: current.totals.expected,
          prev: previous?.totals.expected ?? null,
          highlight: true,
        },
      ]
    : [];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>
          Stock · Valorización
        </h1>
      </div>

      <div className="pc-filter" style={{ flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--ha-text-2)" }}>Comparar hoy contra</span>
        <input
          type="date"
          className="ex-date"
          value={compareDate}
          max={daysAgo(1)}
          onChange={(e) => setCompareDate(e.target.value)}
          title="Fecha de comparación"
        />
        {QUICK_RANGES.map((r) => (
          <button key={r.days} className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setCompareDate(daysAgo(r.days))}>
            {r.label}
          </button>
        ))}
        {compareDate && (
          <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setCompareDate("")}>
            Quitar comparación
          </button>
        )}
        <span style={{ fontSize: 13, color: "var(--ha-text-2)", marginLeft: "auto" }}>Mix</span>
        <select className="pc-select" value={mixMode} onChange={(e) => setMixMode(e.target.value as StockValuationMixMode)}>
          <option value="product">Por producto</option>
          <option value="global">Global</option>
        </select>
      </div>

      {loading && !current ? (
        <Spinner />
      ) : !current ? null : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
            {cards.map((c) => (
              <div
                key={c.label}
                className="ha-stat"
                style={c.highlight ? { borderColor: "var(--ha-amber)" } : undefined}
              >
                <div className="ha-stat__l">{c.label}</div>
                <div className="ha-stat__v">{c.cur == null ? "—" : formatCurrency(c.cur)}</div>
                <div className="ha-stat__s">{c.sub}</div>
                {comparing && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--ha-text-3)", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    <span>
                      {new Date(previous.asOf).toLocaleDateString("es-AR")}: {c.prev == null ? "—" : formatCurrency(c.prev)}
                    </span>
                    <Delta current={c.cur} previous={c.prev} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="ps-card ps-card--pad">
            <div className="ps-card__h">Mix histórico de ventas</div>
            <div className="ps-card__sub">
              Unidades vendidas por lista hasta {comparing ? "cada fecha" : "hoy"}. {mixMode === "global"
                ? "Todos los productos usan este mix global."
                : "Los porcentajes de abajo son el mix global; cada producto usa su propio mix y, si tiene menos de 12 unidades vendidas, el global."}
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginTop: 14 }}>
              <div>
                <div className="ps-label">Minorista</div>
                <div className="us-stat__v">{formatPct(current.mix.retailPct)}</div>
                <div className="ha-stat__s">{formatQuantity(current.mix.retailUnits)} unidades</div>
              </div>
              <div>
                <div className="ps-label">Mayorista</div>
                <div className="us-stat__v">{formatPct(current.mix.wholesalePct)}</div>
                <div className="ha-stat__s">{formatQuantity(current.mix.wholesaleUnits)} unidades</div>
              </div>
              {comparing && (
                <>
                  <div>
                    <div className="ps-label">Minorista ({new Date(previous.asOf).toLocaleDateString("es-AR")})</div>
                    <div className="us-stat__v">{formatPct(previous.mix.retailPct)}</div>
                  </div>
                  <div>
                    <div className="ps-label">Mayorista ({new Date(previous.asOf).toLocaleDateString("es-AR")})</div>
                    <div className="us-stat__v">{formatPct(previous.mix.wholesalePct)}</div>
                  </div>
                </>
              )}
            </div>
            <div className="ha-stat__s" style={{ marginTop: 12 }}>
              No entran al mix: {formatQuantity(current.mix.otherListUnits)} unidades vendidas a precio fábrica o catering y{" "}
              {formatQuantity(current.mix.unclassifiedUnits)} sin lista identificable (pedidos anteriores al 20/04/2026 sin coincidencia de precio).
            </div>
          </div>

          {[current, previous].map((resp) =>
            resp && (resp.warnings.negativeStockProducts.length > 0 || resp.warnings.estimatedPriceProducts.length > 0 || resp.warnings.missingPriceProducts.length > 0) ? (
              <div key={resp.asOf} className="ps-warn">
                <b>⚠ Datos aproximados al {new Date(resp.asOf).toLocaleDateString("es-AR")}</b>
                {resp.warnings.negativeStockProducts.length > 0 && (
                  <div className="ps-warn__row">
                    Stock reconstruido negativo (se valoriza en 0): {resp.warnings.negativeStockProducts.join(", ")}
                  </div>
                )}
                {resp.warnings.estimatedPriceProducts.length > 0 && (
                  <div className="ps-warn__row">
                    Fecha anterior al primer precio registrado (se usó el más antiguo): {resp.warnings.estimatedPriceProducts.join(", ")}
                  </div>
                )}
                {resp.warnings.missingPriceProducts.length > 0 && (
                  <div className="ps-warn__row">Sin precio en alguna lista: {resp.warnings.missingPriceProducts.join(", ")}</div>
                )}
              </div>
            ) : null,
          )}

          <div className="pc-card" style={{ marginTop: 16 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="pc-table" style={{ minWidth: comparing ? 1100 : 860 }}>
                <thead>
                  <tr>
                    <th style={{ width: "auto" }}>Producto</th>
                    <th style={{ textAlign: "right" }}>Stock</th>
                    {comparing && <th style={{ textAlign: "right" }}>Stock {new Date(previous.asOf).toLocaleDateString("es-AR")}</th>}
                    <th style={{ textAlign: "right" }}>Fábrica</th>
                    <th style={{ textAlign: "right" }}>Minorista</th>
                    <th style={{ textAlign: "right" }}>Mayorista</th>
                    <th style={{ textAlign: "right" }}>Mix min / may</th>
                    <th style={{ textAlign: "right" }}>Valor esperado</th>
                    {comparing && <th style={{ textAlign: "right" }}>Esperado {new Date(previous.asOf).toLocaleDateString("es-AR")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ productId, name, cur, prev }) => (
                    <tr key={productId}>
                      <td style={{ fontWeight: 500 }}>{name}</td>
                      <td style={{ textAlign: "right" }}>{cur ? formatQuantity(cur.quantity) : "0"}</td>
                      {comparing && <td style={{ textAlign: "right" }}>{prev ? formatQuantity(prev.quantity) : "0"}</td>}
                      <td style={{ textAlign: "right" }}>{cur?.factoryPrice != null ? formatCurrency(cur.factoryPrice) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{cur?.retailPrice != null ? formatCurrency(cur.retailPrice) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{cur?.wholesalePrice != null ? formatCurrency(cur.wholesalePrice) : "—"}</td>
                      <td style={{ textAlign: "right", color: "var(--ha-text-2)" }}>
                        {cur ? (
                          <>
                            {formatPct(cur.retailShare)} / {formatPct(cur.wholesaleShare)}
                            {mixMode === "product" && cur.mixSource === "global" && <span title="Pocas ventas: usa el mix global"> *</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{cur?.expectedValue != null ? formatCurrency(cur.expectedValue) : "—"}</td>
                      {comparing && (
                        <td style={{ textAlign: "right", color: "var(--ha-text-2)" }}>
                          {prev?.expectedValue != null ? formatCurrency(prev.expectedValue) : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ padding: "12px 18px", fontWeight: 600 }}>Total</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatQuantity(current.rows.reduce((s, r) => s + r.quantity, 0))}</td>
                    {comparing && (
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatQuantity(previous.rows.reduce((s, r) => s + r.quantity, 0))}</td>
                    )}
                    <td colSpan={4} />
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {current.totals.expected != null ? formatCurrency(current.totals.expected) : "—"}
                    </td>
                    {comparing && (
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {previous.totals.expected != null ? formatCurrency(previous.totals.expected) : "—"}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="ha-stat__s" style={{ marginTop: 10 }}>
            {mixMode === "product" && "* Producto con menos de 12 unidades vendidas: usa el mix global. "}Las columnas de precio y mix muestran los valores de hoy.
          </p>
        </div>
      )}
    </div>
  );
}
