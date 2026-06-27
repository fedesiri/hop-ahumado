"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { Cost, PaginationMeta, Product, StockLocation, StockMovement, StockMovementType } from "@/lib/types";
import { Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const UNIT_LABELS: Record<string, string> = {
  UNIT: "UN", KG: "KG", G: "G", L: "L", ML: "ML",
};

const TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "IN", label: "Entrada" },
  { value: "OUT", label: "Salida" },
  { value: "ADJUSTMENT", label: "Ajuste" },
  { value: "TRANSFER", label: "Traslado" },
];

function typeBadge(type: string) {
  switch (type) {
    case "IN": return { cls: "sm-badge sm-badge--in", icon: "↑", label: "Entrada" };
    case "OUT": return { cls: "sm-badge sm-badge--out", icon: "↓", label: "Salida" };
    case "ADJUSTMENT": return { cls: "sm-badge sm-badge--adj", icon: "≡", label: "Ajuste" };
    case "TRANSFER": return { cls: "sm-badge sm-badge--xfr", icon: "⇌", label: "Traslado" };
    default: return { cls: "sm-badge", icon: "", label: type };
  }
}

function qtyDisplay(qty: number, type: string) {
  if (type === "TRANSFER") return { cls: "sm-qty", text: formatQuantity(qty) };
  if (qty > 0) return { cls: "sm-qty sm-qty--pos", text: `+${formatQuantity(qty)}` };
  return { cls: "sm-qty sm-qty--neg", text: formatQuantity(qty) };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function StockPage() {
  return <StockContent />;
}

function StockContent() {
  const { selectedLineId } = useLineContext();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [costsByProductId, setCostsByProductId] = useState<Record<string, Cost>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  // Filters (client-side on current page)
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Form state
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

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    return movements.filter((m) => {
      if (q && !(m.product?.name ?? "").toLowerCase().includes(q)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (locationFilter) {
        const locId = m.location?.id ?? m.fromLocation?.id ?? m.toLocation?.id ?? "";
        if (locId !== locationFilter) return false;
      }
      const d = new Date(m.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [movements, searchText, typeFilter, locationFilter, dateFrom, dateTo]);

  const validRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== "0" && r.quantity !== "");
  const computedProductsCostTotal = roundMoney(
    validRows.reduce((sum, r) => {
      const cost = costsByProductId[r.productId];
      return sum + Number(r.quantity) * (cost ? Number(cost.value ?? 0) : 0);
    }, 0)
  );
  const hasMissingCostForSelectedProducts = validRows.some((r) => !costsByProductId[r.productId]);
  const missingCostProductNames = validRows.filter((r) => !costsByProductId[r.productId]).map((r) => products.find((p) => p.id === r.productId)?.name ?? r.productId);
  const defaultLocationId = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? "";

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;

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
      if (computedProductsCostTotal > 0 && !hasMissingCostForSelectedProducts) {
        const diff = Math.abs(productsTotalPaid - computedProductsCostTotal);
        if (diff > 0.01) {
          toast.error(`El pago informado para productos no coincide con el costo calculado (${computedProductsCostTotal.toFixed(2)}).`);
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
        if (!selectedLineId) {
          toast.error("Seleccioná una línea de negocio antes de registrar una entrada.");
          return;
        }
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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>Stock · Movimientos</h1>
        <button className="pc-btn pc-btn--primary" onClick={handleCreate}>
          + Nuevo movimiento
        </button>
      </div>

      {/* Filter bar */}
      <div className="pc-filter" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="pc-search">
          <Search size={17} />
          <input
            placeholder="Buscar producto…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <select className="pc-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {locations.length > 0 && (
          <select className="pc-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">Todas las ubicaciones</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <input type="date" className="ex-date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Fecha desde" />
        <input type="date" className="ex-date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Fecha hasta" />
        <span className="pc-count">{filtered.length} movimientos</span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)",
            animation: "ha-spin .7s linear infinite",
          }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">{movements.length === 0 ? "No hay movimientos de stock" : "Sin resultados para los filtros aplicados"}</p>
        </div>
      ) : (
        <div className="pc-card">
          <div style={{ overflowX: "auto" }}>
            <table className="pc-table" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Tipo</th>
                  <th>Producto</th>
                  <th style={{ textAlign: "right", width: 90 }}>Cantidad</th>
                  <th style={{ width: 70 }}>Unidad</th>
                  <th>Ubicación</th>
                  <th>Motivo</th>
                  <th style={{ width: 140, whiteSpace: "nowrap" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const badge = typeBadge(row.type);
                  const qty = qtyDisplay(row.quantity, row.type);
                  const unit = row.product?.unit ? (UNIT_LABELS[row.product.unit] ?? row.product.unit) : "—";
                  const locationStr = row.type === "TRANSFER"
                    ? `${row.fromLocation?.name ?? "—"} → ${row.toLocation?.name ?? "—"}`
                    : (row.location?.name ?? "—");
                  const dt = new Date(row.createdAt);
                  const dateStr = dt.toLocaleDateString("es-AR");
                  const timeStr = dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={row.id}>
                      <td><span className={badge.cls}>{badge.icon} {badge.label}</span></td>
                      <td style={{ fontWeight: 500 }}>{row.product?.name ?? "—"}</td>
                      <td style={{ textAlign: "right" }}><span className={qty.cls}>{qty.text}</span></td>
                      <td><span className="sm-unit">{unit}</span></td>
                      <td className="pc-cat">{locationStr}</td>
                      <td><span className="sm-reason">{row.reason ?? "—"}</span></td>
                      <td className="pc-vig" style={{ whiteSpace: "nowrap" }}>{dateStr} {timeStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="sm-pager">
          <button
            className="pc-btn pc-btn--ghost pc-btn--sm"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
          >
            ← Anterior
          </button>
          <span className="sm-pager__info">Página {pagination.page} de {totalPages}</span>
          <button
            className="pc-btn pc-btn--ghost pc-btn--sm"
            disabled={pagination.page >= totalPages}
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Nuevo movimiento de stock</span>
              <button className="ha-iconbtn" onClick={() => setModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
              <div className="ha-field" style={{ marginBottom: 16 }}>
                <label className="ha-label">Tipo de movimiento <span style={{ color: "var(--ha-red)" }}>*</span></label>
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
                Usá decimales si el producto se mide en kg, litros, etc. (ej. 0,5 kg).
              </p>

              <div style={{ marginBottom: 16 }}>
                {rows.map((row, index) => (
                  <div key={index} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      className="ha-input"
                      style={{ minWidth: 200, flex: 1 }}
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
                  + Agregar producto
                </button>
              </div>

              {fType === "IN" && (
                <>
                  <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px solid var(--ha-border)" }}>
                    <p style={{ margin: "0 0 8px 0", color: "var(--ha-text)", fontWeight: 600 }}>Pago de productos</p>
                    <p style={{ margin: "0 0 12px 0", color: "var(--ha-text-3)", fontSize: 13 }}>
                      Costo total calculado: <span style={{ color: "var(--ha-green)" }}>{formatCurrency(computedProductsCostTotal)}</span>
                    </p>
                    <div className="ha-field" style={{ marginBottom: 12 }}>
                      <label className="ha-label">Efectivo</label>
                      <input type="number" className="ha-input" min={0} step={0.01} placeholder="Monto en efectivo" value={fProductsCashAmount} onChange={(e) => setFProductsCashAmount(e.target.value)} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Transferencia</label>
                      <input type="number" className="ha-input" min={0} step={0.01} placeholder="Monto por transferencia" value={fProductsCardAmount} onChange={(e) => setFProductsCardAmount(e.target.value)} />
                    </div>
                    <p style={{ margin: "8px 0 0 0", color: "var(--ha-text-3)", fontSize: 13 }}>
                      Efectivo + transferencia debe coincidir con el costo calculado.
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
                      + Agregar egreso variable
                    </button>
                  </div>
                </>
              )}

              <div className="ha-field">
                <label className="ha-label">Motivo (opcional)</label>
                <input className="ha-input" placeholder="Razón del movimiento" value={fReason} onChange={(e) => setFReason(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
