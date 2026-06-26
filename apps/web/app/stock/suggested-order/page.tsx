"use client";

import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { DistributorSuggestedOrderItem, DistributorSuggestedOrderResponse } from "@/lib/types";
import { Copy, ShoppingCart } from "lucide-react";
import { useState } from "react";

function formatMoneyApprox(n: number) {
  return `~$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatCostDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function SuggestedOrderPage() {
  return <SuggestedOrderContent />;
}

function SuggestedOrderContent() {
  const [loading, setLoading] = useState(false);
  const [distributorOrder, setDistributorOrder] = useState<DistributorSuggestedOrderResponse | null>(null);
  const [params, setParams] = useState({
    literTargetBoxes: 5,
    halfLiterTargetBoxes: 6,
    unitsPerBox: 12,
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDistributorSuggestedOrder({
        literTargetBoxes: params.literTargetBoxes,
        halfLiterTargetBoxes: params.halfLiterTargetBoxes,
        unitsPerBox: params.unitsPerBox,
      });
      setDistributorOrder(res);
    } catch (err) {
      toast.error("No se pudo generar el pedido sugerido");
      console.error(err);
      setDistributorOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async () => {
    if (!distributorOrder?.copyText) return;
    try {
      await navigator.clipboard.writeText(distributorOrder.copyText);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const paramField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 130, flex: 1 }}>
      <label style={{ color: "var(--ha-text-3)", fontSize: 13 }}>{label}</label>
      <input
        type="number"
        className="ha-input"
        min={1}
        max={1000}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
      />
    </div>
  );

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Pedido sugerido</h1>
        <button className="ha-btn ha-btn--primary" onClick={load} disabled={loading}>
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "ha-spin .7s linear infinite" }} />
              Generando…
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ShoppingCart size={15} /> Generar pedido</span>
          )}
        </button>
      </div>

      <ScreenInfoPanel title="Distribuidor — cerveza">
        Solo categoría Cerveza. Litro: objetivo en cajas (12 u/caja) para 1L; medio litro: otro objetivo en cajas para
        ½L. El pedido se redondea a cajas completas. Incluye productos dados de baja. Ajustá los valores y volvé a
        generar.
      </ScreenInfoPanel>

      <div style={{ marginTop: 20, marginBottom: 20, background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ha-border)", display: "flex", alignItems: "center", gap: 8 }}>
          <ShoppingCart size={14} style={{ color: "var(--ha-text-3)" }} />
          <span style={{ color: "var(--ha-text)", fontWeight: 500, fontSize: 14 }}>Parámetros</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            {paramField("Cajas obj. 1L", params.literTargetBoxes, (v) => setParams((p) => ({ ...p, literTargetBoxes: v })))}
            {paramField("Cajas obj. ½L", params.halfLiterTargetBoxes, (v) => setParams((p) => ({ ...p, halfLiterTargetBoxes: v })))}
            {paramField("U. por caja", params.unitsPerBox, (v) => setParams((p) => ({ ...p, unitsPerBox: v })))}
          </div>

          {distributorOrder && (
            <>
              {distributorOrder.unknownFormat.length > 0 && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.4)", display: "flex", gap: 10 }}>
                  <span style={{ color: "#f59e0b", fontSize: 16, flexShrink: 0 }}>⚠</span>
                  <div>
                    <div style={{ color: "#fbbf24", fontWeight: 500, fontSize: 13 }}>Productos de cerveza sin clasificar 1L / ½L</div>
                    <div style={{ color: "var(--ha-text-3)", fontSize: 12, marginTop: 2 }}>
                      No entran al cálculo de pedido. Renombrá o usá unidad L (litro) o ML (medio) en el producto, o
                      incluí "litro", "medio litro" o "500" en el nombre.
                    </div>
                  </div>
                </div>
              )}

              <div style={{ color: "var(--ha-text-3)", fontSize: 12, marginBottom: 8 }}>
                Parámetros: {distributorOrder.parameters.categoryName} — 1L:{" "}
                {distributorOrder.parameters.literTargetBoxes} cajas, ½L:{" "}
                {distributorOrder.parameters.halfLiterTargetBoxes} cajas, {distributorOrder.parameters.unitsPerBox}{" "}
                u/caja.
              </div>

              {distributorOrder.costSummary.orderLinesWithSuggestedUnits > 0 && (
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "linear-gradient(135deg, #0c4a6e 0%, #0f172a 100%)", border: "1px solid #0369a1" }}>
                  <div style={{ color: "#e0f2fe", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    Costo aprox. del pedido: {formatMoneyApprox(distributorOrder.costSummary.approximateTotal)}
                  </div>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 }}>
                    {distributorOrder.costSummary.basis}
                  </p>
                  {distributorOrder.costSummary.orderLinesMissingCost > 0 && (
                    <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                      <div style={{ color: "#fbbf24", fontWeight: 500, fontSize: 12 }}>Productos del pedido sin costo activo en el sistema</div>
                      <div style={{ color: "var(--ha-text-3)", fontSize: 12 }}>{distributorOrder.costSummary.missingCostProductNames.join(", ")}</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button className="ha-btn ha-btn--secondary" onClick={copyText} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Copy size={14} /> Copiar texto (WhatsApp)
                </button>
              </div>

              <details style={{ marginBottom: 12 }} open={previewOpen} onToggle={(e) => setPreviewOpen((e.currentTarget as HTMLDetailsElement).open)}>
                <summary style={{ cursor: "pointer", color: "var(--ha-text-3)", fontSize: 13, padding: "4px 0", userSelect: "none" }}>
                  {previewOpen ? "▾" : "▸"} Ver vista previa del texto
                </summary>
                <div style={{ maxHeight: 220, overflow: "auto", padding: 10, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, color: "#e5e7eb", fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", marginTop: 6 }}>
                  {distributorOrder.copyText}
                </div>
              </details>

              <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" as const, borderRadius: 6 }}>
                <table className="ha-table" style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200 }}>Producto</th>
                      <th style={{ width: 72, textAlign: "center", whiteSpace: "nowrap" }}>Formato</th>
                      <th style={{ width: 72, textAlign: "right", whiteSpace: "nowrap" }}>Stock</th>
                      <th style={{ width: 80, textAlign: "right", whiteSpace: "nowrap" }}>Obj. (u)</th>
                      <th style={{ width: 88, textAlign: "right", whiteSpace: "nowrap" }}>Pedido (u)</th>
                      <th style={{ width: 64, textAlign: "right", whiteSpace: "nowrap" }}>Cajas</th>
                      <th style={{ width: 100, textAlign: "right", whiteSpace: "nowrap" }}>Costo u.</th>
                      <th style={{ width: 100, textAlign: "right", whiteSpace: "nowrap" }}>Aprox. línea</th>
                      <th style={{ width: 72, textAlign: "center", whiteSpace: "nowrap" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributorOrder.items.map((item: DistributorSuggestedOrderItem) => {
                      const d = formatCostDate(item.costRecordedAt);
                      return (
                        <tr key={item.productId} style={item.suggestedUnits > 0 ? { background: "rgba(251, 191, 36, 0.06)" } : undefined}>
                          <td style={{ minWidth: 200 }}>{item.name}</td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: item.format === "LITER" ? "rgba(37,99,235,0.2)" : "rgba(8,145,178,0.2)", color: item.format === "LITER" ? "#93c5fd" : "#67e8f9", border: `1px solid ${item.format === "LITER" ? "rgba(59,130,246,0.4)" : "rgba(14,165,233,0.4)"}` }}>
                              {item.format === "LITER" ? "1L" : "½L"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.currentStock}</td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.targetUnits}</td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            <span style={item.suggestedUnits > 0 ? { color: "var(--ha-amber)" } : undefined}>{item.suggestedUnits}</span>
                          </td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.suggestedBoxes}</td>
                          <td style={{ textAlign: "right" }}>
                            {item.unitCost == null ? (
                              <span style={{ color: "var(--ha-text-4)" }}>—</span>
                            ) : (
                              <div style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1.25 }}>
                                <div style={{ fontSize: 13 }}>{formatMoneyApprox(item.unitCost)}</div>
                                {d && <div style={{ fontSize: 10, color: "var(--ha-text-4)" }} title="Fecha del registro de costo usado">{d}</div>}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {item.suggestedUnits === 0 ? (
                              <span style={{ color: "var(--ha-text-4)" }}>—</span>
                            ) : item.lineApproximateTotal == null ? (
                              <span style={{ color: "var(--ha-text-4)" }}>—</span>
                            ) : (
                              <span style={{ color: "#34d399", fontVariantNumeric: "tabular-nums" }}>{formatMoneyApprox(item.lineApproximateTotal)}</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {item.isDeactivated ? (
                              <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 11, background: "var(--ha-bg-3)", color: "var(--ha-text-3)", border: "1px solid var(--ha-border)" }}>baja</span>
                            ) : (
                              <span style={{ color: "var(--ha-text-4)" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
