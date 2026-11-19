"use client";

import { apiClient } from "@/lib/api-client";
import { compressImage } from "@/lib/compress-image";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import { StockMovementType, type Cost, type PaginationMeta, type Product, type StockLocation, type StockMovement } from "@/lib/types";
import { Paginator } from "@/components/paginator";
import { isSuspiciousQuantity } from "@/components/purchase-stock-section";
import { Spinner } from "@/components/spinner";
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
  const [fDate, setFDate] = useState("");
  const [fSupplier, setFSupplier] = useState("");
  const [fPayLater, setFPayLater] = useState(false);
  const [fReceipt, setFReceipt] = useState<File | null>(null);
  const [fProductsCashAmount, setFProductsCashAmount] = useState("");
  const [fProductsCardAmount, setFProductsCardAmount] = useState("");
  const [fUpdateCosts, setFUpdateCosts] = useState(true);
  const [rows, setRows] = useState<Array<{ productId: string; quantity: string; amount?: string }>>([{ productId: "", quantity: "" }]);
  const [extraExpenseRows, setExtraExpenseRows] = useState<Array<{ description: string; cash: string; card: string }>>([{ description: "", cash: "", card: "" }]);

  useEffect(() => {
    void fetchMovements();
    void fetchProducts();
    void (async () => {
      try { setLocations(await apiClient.getStockLocations(selectedLineId ?? undefined)); } catch { setLocations([]); }
    })();
  }, [pagination.page, pagination.limit, selectedLineId, typeFilter]);

  useEffect(() => {
    if (!modalOpen) return;
    void fetchCosts();
  }, [modalOpen]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStockMovements(pagination.page, pagination.limit, undefined, selectedLineId ?? undefined, typeFilter || undefined);
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
      if (locationFilter) {
        const locId = m.location?.id ?? m.fromLocation?.id ?? m.toLocation?.id ?? "";
        if (locId !== locationFilter) return false;
      }
      const d = new Date(m.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [movements, searchText, locationFilter, dateFrom, dateTo]);

  const validRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== "0" && r.quantity !== "");
  const computedProductsCostTotal = roundMoney(
    validRows.reduce((sum, r) => {
      const cost = costsByProductId[r.productId];
      return sum + Number(r.quantity) * (cost ? Number(cost.value ?? 0) : 0);
    }, 0)
  );
  const hasMissingCostForSelectedProducts = validRows.some((r) => !costsByProductId[r.productId]);
  const missingCostProductNames = validRows.filter((r) => !costsByProductId[r.productId]).map((r) => products.find((p) => p.id === r.productId)?.name ?? r.productId);
  const multiRows = validRows.length > 1;
  const rowAmountsGiven = validRows.length > 0 && validRows.every((r) => Number(r.amount) > 0);
  const rowAmountsTotal = roundMoney(validRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0));
  const paidTotal = (Number(fProductsCashAmount) || 0) + (Number(fProductsCardAmount) || 0);
  /** Importe pagado por cada producto: con uno solo es el pago total; con varios, el que se cargó en cada fila. */
  const paidForRow = (r: { quantity: string; amount?: string }): number =>
    multiRows ? Number(r.amount) || 0 : fPayLater ? 0 : paidTotal;
  /** Total a deber si se paga después: lo cargado por producto, o el costo actual de cada uno. */
  const payLaterTotal = rowAmountsGiven ? rowAmountsTotal : computedProductsCostTotal;
  const defaultLocationId = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? "";

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;

  const handleCreate = () => {
    setFType("");
    setFLocationId(defaultLocationId);
    setFFromLocationId(defaultLocationId);
    setFToLocationId("");
    setFReason("");
    setFDate(new Date().toLocaleDateString("en-CA"));
    setFSupplier("");
    setFPayLater(false);
    setFReceipt(null);
    setFProductsCashAmount("");
    setFProductsCardAmount("");
    setFUpdateCosts(true);
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
    const supplier = fSupplier.trim();
    const reasonText = type === "IN"
      ? [supplier ? `Proveedor: ${supplier}` : "", fReason].filter(Boolean).join(" - ")
      : fReason;
    const movementDay = type === "IN" ? fDate : "";

    if (type === "IN") {
      if (!fDate) { toast.error("Elegí la fecha del movimiento."); return; }
      const tooBig = submitRows.find((r) => {
        const pr = products.find((p) => p.id === r.productId);
        return isSuspiciousQuantity(pr?.unit, Number(r.quantity)) && Number(r.quantity) >= 1000;
      });
      if (tooBig) {
        toast.error(`${products.find((p) => p.id === tooBig.productId)?.name}: ${tooBig.quantity} parece estar en gramos. Se carga en kg o litros (ej. 3,1 y no 3100).`);
        return;
      }
      if (fPayLater) {
        if (payLaterTotal <= 0) {
          toast.error("Para dejar el pago pendiente, cargá el $ de cada producto o que tengan costo cargado.");
          return;
        }
      } else {
        productsCashAmount = Number(fProductsCashAmount) || 0;
        productsCardAmount = Number(fProductsCardAmount) || 0;
        const productsTotalPaid = productsCashAmount + productsCardAmount;
        if (productsTotalPaid <= 0) {
          toast.error("Informá el pago de los productos (efectivo y/o transferencia), o tildá \"Pagar después\".");
          return;
        }
        if (multiRows && rowAmountsGiven && Math.abs(rowAmountsTotal - productsTotalPaid) > 0.01) {
          toast.error(`Los $ por producto suman ${formatCurrency(rowAmountsTotal)} pero el pago informado es ${formatCurrency(productsTotalPaid)}. Tienen que coincidir.`);
          return;
        }
      }
      const invalidExtra = extraExpenseRows.find((r) => (Number(r.cash) > 0 || Number(r.card) > 0) && !r.description.trim());
      if (invalidExtra) {
        toast.error("Si cargás un egreso variable con monto, tenés que ponerle una descripción.");
        return;
      }
      productsDescription = reasonText ? `Productos (costo) - ${reasonText}` : "Productos (costo)";
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
            reason: reasonText || undefined,
            date: movementDay || undefined,
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
        if (!fPayLater) {
          await apiClient.createExpense({ description: productsDescription, cashAmount: productsCashAmount, cardAmount: productsCardAmount, businessLineId: selectedLineId ?? "", date: movementDay });
        }
        const validExtras = extraExpenseRows.filter((r) => Number(r.cash) > 0 || Number(r.card) > 0);
        for (const extra of validExtras) {
          const desc = extra.description.trim();
          await apiClient.createExpense({
            description: reasonText ? `${desc} - ${reasonText}` : desc,
            cashAmount: Number(extra.cash) || 0,
            cardAmount: Number(extra.card) || 0,
            businessLineId: selectedLineId ?? "",
            date: movementDay,
          });
        }

        const date = movementDay;
        const cashFlowRows = [
          { category: "Materia prima", description: productsDescription, cash: productsCashAmount, card: productsCardAmount },
          ...validExtras.map((e) => ({
            category: "Otros gastos",
            description: reasonText ? `${e.description.trim()} - ${reasonText}` : e.description.trim(),
            cash: Number(e.cash) || 0,
            card: Number(e.card) || 0,
          })),
        ];
        // Movimientos de Flujo de caja de los productos: ahí se adjunta el ticket.
        const productMovementIds: string[] = [];
        try {
          if (fPayLater) {
            // Sin pago todavía: queda como deuda pendiente en Flujo de caja.
            const pending = await apiClient.createCashMovement(selectedLineId, {
              date,
              type: "EXPENSE",
              category: "Materia prima",
              description: productsDescription,
              counterparty: supplier || undefined,
              amount: payLaterTotal,
              status: "PENDING",
            });
            productMovementIds.push(pending.id);
          }
          for (const [rowIndex, row] of cashFlowRows.entries()) {
            for (const [amount, paymentMethod] of [[row.cash, "Efectivo"], [row.card, "Transferencia"]] as const) {
              if (amount <= 0) continue;
              const created = await apiClient.createCashMovement(selectedLineId, {
                date,
                type: "EXPENSE",
                category: row.category,
                description: row.description,
                counterparty: supplier || undefined,
                amount,
                paymentMethod,
              });
              if (rowIndex === 0) productMovementIds.push(created.id);
            }
          }
        } catch {
          toast.error("El stock se registró, pero no se pudo cargar el gasto en Flujo de caja. Cargalo a mano.");
        }

        if (fReceipt && productMovementIds.length > 0) {
          try {
            const photo = await compressImage(fReceipt);
            for (const id of productMovementIds) await apiClient.uploadCashReceipt(id, photo);
          } catch {
            toast.error("El stock se registró, pero no se pudo subir el ticket. Adjuntalo desde Flujo de caja.");
          }
        }
      }

      let costNote = "";
      if (type === "IN" && fUpdateCosts) {
        const costItems = submitRows
          .map((r) => ({ productId: r.productId, quantity: Number(r.quantity), amount: paidForRow(r) }))
          .filter((i) => i.amount > 0 && i.quantity > 0);
        if (costItems.length > 0) {
          try {
            const outcomes = await apiClient.applyPurchaseCosts(costItems);
            const name = (id: string) => products.find((p) => p.id === id)?.name ?? "producto";
            const updated = outcomes.flatMap((o) => (o.kind === "updated" ? [`${name(o.productId)} ${formatCurrency(o.to)}`] : []));
            const skipped = outcomes.flatMap((o) =>
              o.kind === "skipped" && o.note !== "El costo ya era ese" ? [`${name(o.productId)} (${o.note})`] : [],
            );
            if (updated.length > 0) costNote += `. Costo actualizado: ${updated.join(", ")}`;
            if (skipped.length > 0) costNote += `. Sin cambio de costo: ${skipped.join("; ")}`;
          } catch {
            costNote = ". No se pudo actualizar el costo: hacelo desde Costos";
          }
        }
      }

      toast.success(`Movimientos de stock registrados${costNote}`);
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
        <select className="pc-select" value={typeFilter} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setTypeFilter(e.target.value); }}>
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
        <Spinner />
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
      {meta && (
        <Paginator
          page={pagination.page}
          totalPages={totalPages}
          total={meta.total}
          label="movimientos"
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        />
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
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({UNIT_LABELS[p.unit] ?? ""}) · stock {formatQuantity(p.stock)}</option>)}
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
                    {fType === "IN" && multiRows && row.productId && (
                      <input
                        type="number"
                        className="ha-input"
                        style={{ width: 150 }}
                        placeholder="$ de este producto"
                        min={0}
                        step={0.01}
                        value={row.amount ?? ""}
                        onChange={(e) => { const next = [...rows]; next[index].amount = e.target.value; setRows(next); }}
                        aria-label="Importe de este producto"
                      />
                    )}
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
                {rows.map((row, index) => {
                  const pr = products.find((p) => p.id === row.productId);
                  const q = Number(row.quantity);
                  if (!pr || !(q > 0)) return null;
                  const suspicious = isSuspiciousQuantity(pr.unit, q);
                  const paid = fType === "IN" ? paidForRow(row) : 0;
                  const oldCost = costsByProductId[pr.id] ? Number(costsByProductId[pr.id].value) : null;
                  const newCost = paid > 0 ? paid / q : null;
                  const sign = fType === "OUT" ? -1 : fType === "IN" ? 1 : 0;
                  return (
                    <div key={`info-${index}`} style={{ fontSize: 12, marginBottom: 6, color: suspicious ? "var(--ha-red)" : "var(--ha-text-3)" }}>
                      <b>{pr.name}:</b> {suspicious ? `⚠ ${formatQuantity(q)} ${UNIT_LABELS[pr.unit]} es mucho, ¿lo pusiste en gramos? Acá va en kg o litros. ` : ""}
                      {sign !== 0 && <>stock {formatQuantity(pr.stock)} → <b>{formatQuantity(pr.stock + sign * q)} {UNIT_LABELS[pr.unit]}</b></>}
                      {fType === "IN" && fUpdateCosts && newCost !== null && (
                        <> · costo por {UNIT_LABELS[pr.unit]}: {oldCost !== null ? `${formatCurrency(oldCost)} → ` : "nuevo: "}<b>{formatCurrency(newCost)}</b></>
                      )}
                    </div>
                  );
                })}
                <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setRows([...rows, { productId: "", quantity: "" }])}>
                  + Agregar producto
                </button>
              </div>

              {fType === "IN" && (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <div className="ha-field" style={{ minWidth: 160, flex: 1 }}>
                      <label className="ha-label">Fecha</label>
                      <input type="date" className="ha-input" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                    </div>
                    <div className="ha-field" style={{ minWidth: 200, flex: 2 }}>
                      <label className="ha-label">Proveedor</label>
                      <input className="ha-input" placeholder="A quién se le compra" value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} />
                    </div>
                  </div>

                  <div className="ha-field" style={{ marginBottom: 16 }}>
                    <label className="ha-label">Ticket / foto del detalle (opcional)</label>
                    {fReceipt ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span>{fReceipt.name}</span>
                        <button type="button" className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setFReceipt(null)}>Quitar</button>
                      </div>
                    ) : (
                      <input type="file" accept="image/*" className="ha-input" onChange={(e) => { setFReceipt(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                    )}
                  </div>

                  <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px solid var(--ha-border)" }}>
                    <p style={{ margin: "0 0 8px 0", color: "var(--ha-text)", fontWeight: 600 }}>Pago de productos</p>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, fontSize: 13 }}>
                      <input type="checkbox" checked={fUpdateCosts} onChange={(e) => setFUpdateCosts(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>
                        Actualizar el costo de estos productos con el precio de esta compra
                        {multiRows && !rowAmountsGiven && fUpdateCosts && (
                          <span style={{ display: "block", fontSize: 12, color: "var(--ha-text-3)" }}>Completá el $ de cada producto para que se actualice su costo.</span>
                        )}
                      </span>
                    </label>
                    <p style={{ margin: "0 0 12px 0", color: "var(--ha-text-3)", fontSize: 13 }}>
                      {computedProductsCostTotal > 0 ? <>Con los costos actuales serían: <span style={{ color: "var(--ha-green)" }}>{formatCurrency(computedProductsCostTotal)}</span>. </> : null}
                      Cargá lo que realmente pagaste.
                    </p>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13 }}>
                      <input type="checkbox" checked={fPayLater} onChange={(e) => setFPayLater(e.target.checked)} /> Pagar después (queda pendiente en Flujo de caja)
                    </label>
                    {!fPayLater && (
                      <>
                        <div className="ha-field" style={{ marginBottom: 12 }}>
                          <label className="ha-label">Efectivo</label>
                          <input type="number" className="ha-input" min={0} step={0.01} placeholder="Monto en efectivo" value={fProductsCashAmount} onChange={(e) => setFProductsCashAmount(e.target.value)} />
                        </div>
                        <div className="ha-field">
                          <label className="ha-label">Transferencia</label>
                          <input type="number" className="ha-input" min={0} step={0.01} placeholder="Monto por transferencia" value={fProductsCardAmount} onChange={(e) => setFProductsCardAmount(e.target.value)} />
                        </div>
                        <p style={{ margin: "8px 0 0 0", color: "var(--ha-text-3)", fontSize: 13 }}>
                          {paidTotal > 0 && computedProductsCostTotal > 0 && Math.abs(paidTotal - computedProductsCostTotal) > 0.01
                            ? `Pagaste ${formatCurrency(paidTotal)} y con los costos actuales serían ${formatCurrency(computedProductsCostTotal)}: se actualiza el costo con lo que pagaste.`
                            : "Efectivo + transferencia es lo que pagaste por los productos."}
                        </p>
                      </>
                    )}
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
