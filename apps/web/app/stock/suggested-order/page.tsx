"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { toast } from "@/lib/toast";
import type { DistributorSuggestedOrderResponse } from "@/lib/types";
import { ChevronDown, Copy } from "lucide-react";
import { useState } from "react";

function formatCostDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function SuggestedOrderPage() {
  return <SuggestedOrderContent />;
}

function SuggestedOrderContent() {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<DistributorSuggestedOrderResponse | null>(null);
  const [params, setParams] = useState({ literTargetBoxes: 5, halfLiterTargetBoxes: 6, unitsPerBox: 12 });
  const [infoOpen, setInfoOpen] = useState(true);

  const calcular = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDistributorSuggestedOrder(params);
      setOrder(res);
    } catch {
      toast.error("No se pudo generar el pedido sugerido");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const copyWA = async () => {
    if (!order?.copyText) return;
    try {
      await navigator.clipboard.writeText(order.copyText);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>
          Pedido Sugerido
          <span style={{ color: "var(--ha-text-3)", fontWeight: 400, fontSize: "0.72em", marginLeft: 10 }}>
            · Distribuidora
          </span>
        </h1>
      </div>

      {/* Params card */}
      <div className="ps-card ps-card--pad">
        <div className="ps-card__h">Parámetros del pedido</div>
        <div className="ps-card__sub">Ingresá la cantidad de cajas objetivo por formato</div>
        <div className="ps-params">
          <div className="ps-field">
            <label className="ps-label">Cajas objetivo (1 litro)</label>
            <input
              type="number" className="ps-input" min={1} max={1000}
              value={params.literTargetBoxes}
              onChange={(e) => setParams((p) => ({ ...p, literTargetBoxes: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
          <div className="ps-field">
            <label className="ps-label">Cajas objetivo (½ litro)</label>
            <input
              type="number" className="ps-input" min={1} max={1000}
              value={params.halfLiterTargetBoxes}
              onChange={(e) => setParams((p) => ({ ...p, halfLiterTargetBoxes: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
          <div className="ps-field">
            <label className="ps-label">Unidades por caja</label>
            <input
              type="number" className="ps-input" min={1} max={1000}
              value={params.unitsPerBox}
              onChange={(e) => setParams((p) => ({ ...p, unitsPerBox: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
          <button
            className="pc-btn pc-btn--primary ps-calcbtn"
            style={{ height: 44, alignSelf: "flex-end", flexShrink: 0 }}
            onClick={() => void calcular()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span style={{
                  display: "inline-block", width: 14, height: 14, borderRadius: "50%",
                  border: "2px solid rgba(0,0,0,0.25)", borderTopColor: "#000",
                  animation: "ha-spin .7s linear infinite",
                }} />
                Calculando…
              </>
            ) : "Calcular"}
          </button>
        </div>
      </div>

      {/* Info collapsible */}
      <div className={"ps-collapse" + (infoOpen ? " open" : "")}>
        <div className="ps-collapse__h" onClick={() => setInfoOpen((v) => !v)} role="button" aria-expanded={infoOpen}>
          <span>ℹ️</span>
          <span>Cómo funciona</span>
          <ChevronDown size={16} className="ps-collapse__chev" />
        </div>
        {infoOpen && (
          <div className="ps-collapse__b">
            Las <b>Unidades sugeridas</b> son el resultado de: (objetivo en unidades) − stock actual. Solo se muestran valores positivos. El total aproximado usa los últimos costos registrados para cada producto.
          </div>
        )}
      </div>

      {/* Results */}
      {order && (
        <>
          {/* Table + mobile cards */}
          <div className="pc-card" style={{ marginBottom: 16 }}>
            {/* Desktop table */}
            <div className="ps-tablewrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Formato</th>
                    <th className="r">Stock actual</th>
                    <th className="r">Objetivo</th>
                    <th className="r">Unid. sugeridas</th>
                    <th className="r">Cajas</th>
                    <th className="r">Costo unit.</th>
                    <th className="r">Total aprox.</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => {
                    const hasSug = item.suggestedUnits > 0;
                    const d = formatCostDate(item.costRecordedAt);
                    return (
                      <tr key={item.productId}>
                        <td style={{ minWidth: 180 }}>{item.name}</td>
                        <td>
                          <span className={"ps-fmt " + (item.format === "LITER" ? "ps-fmt--1" : "ps-fmt--h")}>
                            {item.format === "LITER" ? "1 L" : "½ L"}
                          </span>
                        </td>
                        <td className="r">{item.currentStock}</td>
                        <td className="r">{item.targetUnits}</td>
                        <td className={"r" + (hasSug ? " ps-sugcell" : "")}>
                          {hasSug
                            ? <span className="ps-sug">{item.suggestedUnits}</span>
                            : <span style={{ color: "var(--ha-text-3)" }}>—</span>}
                        </td>
                        <td className="r">
                          {hasSug
                            ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.suggestedBoxes}</span>
                            : <span style={{ color: "var(--ha-text-3)" }}>—</span>}
                        </td>
                        <td className="r">
                          {item.unitCost == null ? (
                            <span style={{ color: "var(--ha-text-3)" }}>—</span>
                          ) : (
                            <div style={{ lineHeight: 1.25 }}>
                              <div style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.unitCost)}</div>
                              {d && <div style={{ fontSize: 10, color: "var(--ha-text-3)" }}>{d}</div>}
                            </div>
                          )}
                        </td>
                        <td className={"r" + (hasSug ? " ps-sugcell" : "")}>
                          {hasSug && item.lineApproximateTotal != null
                            ? <span className="ps-sug">{formatCurrency(item.lineApproximateTotal)}</span>
                            : <span style={{ color: "var(--ha-text-3)" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="ps-tfoot">
                  <tr>
                    <td colSpan={7}>Total aproximado</td>
                    <td className="amt">{formatCurrency(order.costSummary.approximateTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="ps-cardlist">
              {order.items.map((item) => {
                const hasSug = item.suggestedUnits > 0;
                return (
                  <div key={item.productId} className={"ps-pcard" + (hasSug ? " has" : "")}>
                    <div className="ps-pcard__top">
                      <span className="ps-pcard__n">{item.name}</span>
                      <span className={"ps-fmt " + (item.format === "LITER" ? "ps-fmt--1" : "ps-fmt--h")}>
                        {item.format === "LITER" ? "1 L" : "½ L"}
                      </span>
                    </div>
                    <div className="ps-pcard__mid">
                      <span>Stock: <strong style={{ color: "var(--ha-text)" }}>{item.currentStock}</strong></span>
                      <span>Objetivo: <strong style={{ color: "var(--ha-text)" }}>{item.targetUnits}</strong></span>
                    </div>
                    <div className="ps-pcard__bot">
                      <div>
                        <span className={"ps-pcard__sug" + (hasSug ? "" : " zero")}>
                          {hasSug ? item.suggestedUnits : "—"}
                        </span>
                        {hasSug && (
                          <span className="ps-pcard__cajas">
                            {" "}~{item.suggestedBoxes} {item.suggestedBoxes === 1 ? "caja" : "cajas"}
                          </span>
                        )}
                      </div>
                      {hasSug && item.lineApproximateTotal != null && (
                        <span className="ps-pcard__total">{formatCurrency(item.lineApproximateTotal)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary + WhatsApp */}
          <div className="ps-card">
            <div className="ps-summary">
              <div>
                <p className="ps-sumtot">
                  Total aproximado: {formatCurrency(order.costSummary.approximateTotal)}
                </p>
                <p className="ps-sumstat">
                  Líneas con pedido:{" "}
                  <strong>{order.costSummary.orderLinesWithSuggestedUnits} de {order.items.length}</strong>
                </p>
                <p className={"ps-sumstat" + (order.costSummary.orderLinesWithCost > 0 ? " g" : "")}>
                  Con costo registrado: <strong>{order.costSummary.orderLinesWithCost}</strong>
                </p>
                <p className="ps-sumstat">
                  Sin costo registrado: <strong>{order.costSummary.orderLinesMissingCost}</strong>
                </p>
              </div>
              <div>
                <button
                  className="pc-btn pc-btn--primary"
                  style={{ width: "100%", height: 44, justifyContent: "center", gap: 8 }}
                  onClick={() => void copyWA()}
                >
                  <Copy size={15} /> Copiar para WhatsApp
                </button>
                <textarea className="ps-wa" readOnly value={order.copyText} rows={5} />
              </div>
            </div>
          </div>

          {/* Unknown format warning */}
          {order.unknownFormat.length > 0 && (
            <div className="ps-warn">
              <b>
                ⚠ {order.unknownFormat.length}{" "}
                {order.unknownFormat.length === 1 ? "producto sin formato reconocido" : "productos sin formato reconocido"}
                {" "}· No se incluyó en el cálculo:
              </b>
              <div className="ps-warn__row">
                {order.unknownFormat.map((u) => `${u.name} · ${u.currentStock} UN en stock`).join(" · ")}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
