"use client";

import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { Cost, PaginationMeta, Product, StockLocation, StockMovement, StockMovementType } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function StockPage() {
  return <StockContent />;
}

function StockContent() {
  const { selectedLineId } = useLineContext();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [costsByProductId, setCostsByProductId] = useState<Record<string, Cost>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  // Form state (replaces antd Form)
  const [fType, setFType] = useState<StockMovementType | "">("");
  const [fLocationId, setFLocationId] = useState("");
  const [fFromLocationId, setFFromLocationId] = useState("");
  const [fToLocationId, setFToLocationId] = useState("");
  const [fReason, setFReason] = useState("");
  const [fProductsCashAmount, setFProductsCashAmount] = useState("");
  const [fProductsCardAmount, setFProductsCardAmount] = useState("");
  const [rows, setRows] = useState<Array<{ productId: string; quantity: string }>>([{ productId: "", quantity: "" }]);
  const [extraExpenseRows, setExtraExpenseRows] = useState<Array<{ description: string; cash: string; card: string }>>([{ description: "", cash: "", card: "" }]);

  useEffect(() => {
    void fetchMovements();
    void fetchProducts();
    void (async () => {
      try { setLocations(await apiClient.getStockLocations()); } catch { setLocations([]); }
    })();
  }, [pagination.page, pagination.limit, selectedLineId]);

  useEffect(() => {
    if (!modalOpen) return;
    void fetchCosts();
  }, [modalOpen]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStockMovements(pagination.page, pagination.limit, undefined, selectedLineId ?? undefined);
      setMovements(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar movimientos");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await apiClient.getProducts(1, 100, false, undefined, undefined, selectedLineId ?? undefined);
      setProducts(response.data);
    } catch {
      // silent
    }
  };

  const fetchCosts = async () => {
    try {
      const limit = 100;
      let page = 1;
      let res = await apiClient.getCosts(page, limit, undefined, true);
      const all: Cost[] = [...res.data];
      while (res.meta.totalPages > page) {
        page += 1;
        res = await apiClient.getCosts(page, limit, undefined, true);
        all.push(...res.data);
      }
      const map: Record<string, Cost> = {};
      for (const c of all) map[c.productId] = c;
      setCostsByProductId(map);
    } catch {
      toast.error("Error al cargar costos");
      setCostsByProductId({});
    }
  };

  const validRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== "0" && r.quantity !== "");
  const computedProductsCostTotal = roundMoney(
    validRows.reduce((sum, r) => {
      const cost = costsByProductId[r.productId];
      const unitCost = cost ? Number(cost.value ?? 0) : 0;
      return sum + Number(r.quantity) * unitCost;
    }, 0)
  );
  const hasMissingCostForSelectedProducts = validRows.some((r) => !costsByProductId[r.productId]);
  const missingCostProductNames = validRows.filter((r) => !costsByProductId[r.productId]).map((r) => products.find((p) => p.id === r.productId)?.name || r.productId);

  const defaultLocationId = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? "";

  const handleCreate = () => {
    setFType("");
    setFLocationId(defaultLocationId);
    setFFromLocationId(defaultLocationId);
    setFToLocationId("");
    setFReason("");
    setFProductsCashAmount("");
    setFProductsCardAmount("");
    setRows([{ productId: "", quantity: "" }]);
    setExtraExpenseRows([{ description: "", cash: "", card: "" }]);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const type = fType as StockMovementType;
    if (!type) { toast.error("Seleccioná el tipo de movimiento"); return; }

    const submitRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== "0");
    if (submitRows.length === 0) { toast.error("Debes cargar al menos un producto con cantidad"); return; }

    let productsCashAmount = 0;
    let productsCardAmount = 0;
    let productsDescription = "";

    if (type === "IN") {
      if (hasMissingCostForSelectedProducts) {
        toast.error(`Falta costo para: ${missingCostProductNames.join(", ")}.`);
        return;
      }
      productsCashAmount = Number(fProductsCashAmount) || 0;
      productsCardAmount = Number(fProductsCardAmount) || 0;
      const productsTotalPaid = productsCashAmount + productsCardAmount;
      if (productsTotalPaid <= 0) {
        toast.error("Para una entrada de stock, informá el pago de los productos (efectivo y/o transferencia).");
        return;
      }
      const computedTotal = computedProductsCostTotal;
      if (computedTotal > 0 && !hasMissingCostForSelectedProducts) {
        const diff = Math.abs(productsTotalPaid - computedTotal);
        if (diff > 0.01) {
          toast.error(`El pago informado para productos no coincide con el costo calculado (${computedTotal.toFixed(2)}).`);
          return;
        }
      }
      const invalidExtra = extraExpenseRows.find((r) => (Number(r.cash) > 0 || Number(r.card) > 0) && !r.description.trim());
      if (invalidExtra) {
        toast.error("Si cargás un egreso variable con monto, tenés que ponerle una descripción.");
        return;
      }
      productsDescription = fReason ? `Productos (costo) - ${fReason}` : "Productos (costo)";
    }

    if (type === "TRANSFER") {
      if (!fFromLocationId || !fToLocationId) { toast.error("En traslado elegí ubicación de origen y destino."); return; }
      if (fFromLocationId === fToLocationId) { toast.error("Origen y destino deben ser distintos."); return; }
    } else if (locations.length > 0 && !fLocationId) {
      toast.error("Elegí la ubicación del movimiento."); return;
    }

    setSubmitting(true);
    try {
      await Promise.all(
        submitRows.map((r) =>
          apiClient.createStockMovement({
            productId: r.productId,
            quantity: Number(r.quantity),
            type,
            reason: fReason || undefined,
            ...(type === "TRANSFER"
              ? { fromLocationId: fFromLocationId, toLocationId: fToLocationId }
              : { locationId: fLocationId }),
          })
        )
      );

      if (type === "IN") {
        await apiClient.createExpense({ description: productsDescription, cashAmount: productsCashAmount, cardAmount: productsCardAmount, businessLineId: selectedLineId ?? "" });
        const validExtras = extraExpenseRows.filter((r) => Number(r.cash) > 0 || Number(r.card) > 0);
        for (const extra of validExtras) {
          const desc = extra.description.trim();
          await apiClient.createExpense({
            description: fReason ? `${desc} - ${fReason}` : desc,
            cashAmount: Number(extra.cash) || 0,
            cardAmount: Number(extra.card) || 0,
            businessLineId: selectedLineId ?? "",
          });
        }
      }

      toast.success("Movimientos de stock registrados");
      setModalOpen(false);
      void fetchMovements();
    } catch {
      toast.error("Error al registrar movimiento");
    } finally {
      setSubmitting(false);
    }
  };

  const getMovementTypeBadgeStyle = (type: string) => {
    switch (type) {
      case "IN": return { background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" };
      case "OUT": return { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" };
      case "ADJUSTMENT": return { background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" };
      case "TRANSFER": return { background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" };
      default: return { background: "var(--ha-bg-3)", color: "var(--ha-text-3)", border: "1px solid var(--ha-border)" };
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) { case "IN": return "Entrada"; case "OUT": return "Salida"; case "ADJUSTMENT": return "Ajuste"; case "TRANSFER": return "Traslado"; default: return type; }
  };

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Movimientos de Stock</h1>
        <button className="ha-btn ha-btn--primary" onClick={handleCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Registrar Movimiento
        </button>
      </div>

      <ScreenInfoPanel title="Unidades y decimales en movimientos">
        Usá decimales si el producto se mide en kg, litros, etc. (ej. entrada 2,5 kg de tomate). Mantené la misma unidad
        que en el producto y en recetas.
      </ScreenInfoPanel>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : movements.length === 0 ? (
        <div className="ha-empty"><p className="ha-empty__t">No hay movimientos de stock</p></div>
      ) : (
        <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" as const }}>
          <table className="ha-table" style={{ minWidth: isMobile ? 680 : undefined }}>
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Producto</th>
                <th style={{ minWidth: isMobile ? 112 : 160 }}>{isMobile ? "Ubicación" : "Ubicación / traslado"}</th>
                <th style={{ width: isMobile ? 86 : 108, textAlign: "center" }}>Tipo</th>
                <th style={{ width: isMobile ? 72 : 88, textAlign: "right" }}>Cant.</th>
                <th style={{ minWidth: 100 }}>Razón</th>
                <th style={{ width: isMobile ? 76 : 96 }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 500 }}>{row.product?.name || "—"}</td>
                  <td>
                    {row.type === "TRANSFER" ? (
                      isMobile ? (
                        <div style={{ fontSize: 12, lineHeight: 1.35, color: "var(--ha-text)" }}>
                          <div>{row.fromLocation?.name ?? "—"}</div>
                          <div style={{ color: "var(--ha-text-3)", margin: "2px 0" }}>→</div>
                          <div>{row.toLocation?.name ?? "—"}</div>
                        </div>
                      ) : `${row.fromLocation?.name ?? "—"} → ${row.toLocation?.name ?? "—"}`
                    ) : (row.location?.name ?? "—")}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: isMobile ? 11 : 12, fontWeight: 500, ...getMovementTypeBadgeStyle(row.type) }}>
                      {getMovementTypeLabel(row.type)}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatQuantity(row.quantity)}</td>
                  <td style={{ color: "var(--ha-text-3)" }}>{row.reason || "—"}</td>
                  <td style={{ fontSize: isMobile ? 12 : undefined, whiteSpace: "nowrap", color: "var(--ha-text-3)" }}>
                    {new Date(row.createdAt).toLocaleDateString("es-AR", isMobile ? { day: "2-digit", month: "2-digit" } : undefined)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 16 }}>
          <span style={{ color: "var(--ha-text-3)", fontSize: 13 }}>{meta.total} total · página {pagination.page} de {totalPages}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>‹</button>
            <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page >= totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>›</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: isMobile ? "calc(100vw - 24px)" : 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Registrar Movimiento de Stock</span>
              <button className="ha-iconbtn" onClick={() => setModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body" style={{ maxHeight: isMobile ? "75vh" : undefined, overflowY: "auto" }}>
              <div className="ha-field" style={{ marginBottom: 16 }}>
                <label className="ha-label">Tipo de Movimiento <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <select className="ha-input" value={fType} onChange={(e) => setFType(e.target.value as StockMovementType | "")}>
                  <option value="">Seleccioná tipo</option>
                  <option value="IN">Entrada</option>
                  <option value="OUT">Salida</option>
                  <option value="ADJUSTMENT">Ajuste</option>
                  <option value="TRANSFER">Traslado entre ubicaciones</option>
                </select>
              </div>

              {fType === "TRANSFER" ? (
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                  <div className="ha-field" style={{ minWidth: 200, flex: 1 }}>
                    <label className="ha-label">Origen</label>
                    <select className="ha-input" value={fFromLocationId} onChange={(e) => setFFromLocationId(e.target.value)}>
                      <option value="">Ubicación origen</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="ha-field" style={{ minWidth: 200, flex: 1 }}>
                    <label className="ha-label">Destino</label>
                    <select className="ha-input" value={fToLocationId} onChange={(e) => setFToLocationId(e.target.value)}>
                      <option value="">Ubicación destino</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="ha-field" style={{ marginBottom: 16 }}>
                  <label className="ha-label">Ubicación</label>
                  <select className="ha-input" value={fLocationId} onChange={(e) => setFLocationId(e.target.value)}>
                    <option value="">Ubicación del movimiento</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.isDefault ? `${l.name} (predeterminada)` : l.name}</option>)}
                  </select>
                </div>
              )}

              <p style={{ margin: "0 0 12px 0", color: "var(--ha-text-3)", fontSize: 13 }}>
                Producto y cantidad: misma unidad que definiste al cargar el producto (enteros o decimales, ej. 0,5 kg).
              </p>

              <div style={{ marginBottom: 16 }}>
                {rows.map((row, index) => (
                  <div key={index} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      className="ha-input"
                      style={{ minWidth: 220, flex: 1 }}
                      value={row.productId}
                      onChange={(v) => { const next = [...rows]; next[index].productId = v.target.value; setRows(next); }}
                    >
                      <option value="">Producto</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      type="number"
                      className="ha-input"
                      style={{ width: 110 }}
                      placeholder="Cantidad"
                      min={0}
                      step={0.01}
                      value={row.quantity}
                      onChange={(e) => { const next = [...rows]; next[index].quantity = e.target.value; setRows(next); }}
                    />
                    {rows.length > 1 && (
                      <button
                        onClick={() => { const next = rows.filter((_, i) => i !== index); setRows(next.length ? next : [{ productId: "", quantity: "" }]); }}
                        style={{ padding: "6px 10px", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 6, color: "var(--ha-red)", cursor: "pointer", fontSize: 13 }}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ))}
                <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setRows([...rows, { productId: "", quantity: "" }])}>
                  Agregar producto
                </button>
              </div>

              {fType === "IN" && (
                <>
                  <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px solid var(--ha-border)" }}>
                    <p style={{ margin: "0 0 8px 0", color: "var(--ha-text)", fontWeight: 600 }}>Pago de productos (solo para Entrada)</p>
                    <p style={{ margin: "0 0 12px 0", color: "var(--ha-text-3)", fontSize: 13 }}>
                      Costo total calculado: <span style={{ color: "#22c55e" }}>{formatCurrency(computedProductsCostTotal)}</span>
                    </p>
                    <div className="ha-field" style={{ marginBottom: 12 }}>
                      <label className="ha-label">Productos - Efectivo</label>
                      <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ingresá monto en efectivo" value={fProductsCashAmount} onChange={(e) => setFProductsCashAmount(e.target.value)} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Productos - Transferencia</label>
                      <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ingresá monto por transferencia" value={fProductsCardAmount} onChange={(e) => setFProductsCardAmount(e.target.value)} />
                    </div>
                    <p style={{ margin: "8px 0 0 0", color: "var(--ha-text-3)", fontSize: 13 }}>
                      El total de efectivo + transferencia debe coincidir con el costo calculado.
                    </p>
                  </div>

                  <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px solid var(--ha-border)" }}>
                    <p style={{ margin: "0 0 8px 0", color: "var(--ha-text)", fontWeight: 600 }}>Otros egresos variables (opcionales)</p>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 110px 36px", gap: 8, marginBottom: 8, color: "var(--ha-text-3)", fontSize: 12 }}>
                      <span>Concepto</span><span>Efectivo</span><span>Transferencia</span><span />
                    </div>
                    {extraExpenseRows.map((row, index) => (
                      <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 110px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                        <input className="ha-input" placeholder="Concepto (ej. leña, nafta, peaje)" value={row.description} onChange={(e) => { const next = [...extraExpenseRows]; next[index].description = e.target.value; setExtraExpenseRows(next); }} />
                        <input type="number" className="ha-input" placeholder="Efectivo" min={0} step={0.01} value={row.cash} onChange={(e) => { const next = [...extraExpenseRows]; next[index].cash = e.target.value; setExtraExpenseRows(next); }} />
                        <input type="number" className="ha-input" placeholder="Transferencia" min={0} step={0.01} value={row.card} onChange={(e) => { const next = [...extraExpenseRows]; next[index].card = e.target.value; setExtraExpenseRows(next); }} />
                        <button
                          disabled={extraExpenseRows.length === 1}
                          onClick={() => { const next = extraExpenseRows.filter((_, i) => i !== index); setExtraExpenseRows(next.length ? next : [{ description: "", cash: "", card: "" }]); }}
                          style={{ display: "grid", placeItems: "center", width: 36, height: 36, border: "1px solid var(--ha-border)", background: "transparent", borderRadius: 6, color: "var(--ha-red)", cursor: "pointer", opacity: extraExpenseRows.length === 1 ? 0.4 : 1 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setExtraExpenseRows([...extraExpenseRows, { description: "", cash: "", card: "" }])}>
                      Agregar egreso variable
                    </button>
                  </div>
                </>
              )}

              <div className="ha-field">
                <label className="ha-label">Razón (Opcional)</label>
                <input className="ha-input" placeholder="Razón del movimiento" value={fReason} onChange={(e) => setFReason(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>{submitting ? "Guardando…" : "Registrar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
