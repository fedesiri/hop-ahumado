"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { PRICE_TYPE_LABELS, PRICE_TYPES, type PriceType } from "@/lib/order-calculator/price-types";
import { toast } from "@/lib/toast";
import type { Customer, Product, Quote, QuoteItemRequest } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Paginator } from "@/components/paginator";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { Spinner } from "@/components/spinner";
import { Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

type DraftItem = QuoteItemRequest & { productName: string };

async function fetchSuggestedPrice(productId: string, channel: PriceType): Promise<number> {
  try {
    await apiClient.getRecipeCostProfile(productId);
    const pricing = await apiClient.getRecipePricing(productId);
    return pricing.channels.find((c) => c.channel === channel)?.finalPrice ?? 0;
  } catch {
    try {
      const res = await apiClient.getPrices(1, 5, productId, true, undefined, channel);
      return res.data[0] ? Number(res.data[0].value) : 0;
    } catch {
      return 0;
    }
  }
}

export default function QuotesPage() {
  return <QuotesContent />;
}

function QuotesContent() {
  const { selectedLineId } = useLineContext();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fCustomerId, setFCustomerId] = useState("");
  const [fClientName, setFClientName] = useState("");
  const [fEventDate, setFEventDate] = useState("");
  const [fSaleType, setFSaleType] = useState("");
  const [fPeopleCount, setFPeopleCount] = useState("");
  const [fDiscountPct, setFDiscountPct] = useState("");
  const [fExtraTransport, setFExtraTransport] = useState("");
  const [fExtraPackaging, setFExtraPackaging] = useState("");
  const [fExtraStaff, setFExtraStaff] = useState("");
  const [fExtraOvertime, setFExtraOvertime] = useState("");
  const [fExtraOther, setFExtraOther] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const [lineProductId, setLineProductId] = useState("");
  const [lineChannel, setLineChannel] = useState<PriceType>("catering");
  const [lineQty, setLineQty] = useState("");
  const [lineUnitPrice, setLineUnitPrice] = useState("");
  const [lineLoading, setLineLoading] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getQuotes(pagination.page, pagination.limit, selectedLineId ?? undefined);
      setQuotes(res.data);
      setMeta(res.meta);
    } catch {
      toast.error("Error al cargar presupuestos");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedLineId]);

  const fetchProducts = useCallback(async () => {
    const bId = selectedLineId ?? undefined;
    const res = await apiClient.getProducts(1, 100, false, undefined, undefined, bId);
    setProducts(res.data);
  }, [selectedLineId]);

  const fetchCustomers = useCallback(async () => {
    const res = await apiClient.getCustomers(1, 100);
    setCustomers(res.data);
  }, []);

  useEffect(() => { void fetchQuotes(); }, [fetchQuotes]);
  useEffect(() => { void fetchProducts(); }, [fetchProducts]);
  useEffect(() => { void fetchCustomers(); }, [fetchCustomers]);

  const resetForm = () => {
    setFCustomerId(""); setFClientName(""); setFEventDate(""); setFSaleType(""); setFPeopleCount("");
    setFDiscountPct(""); setFExtraTransport(""); setFExtraPackaging(""); setFExtraStaff("");
    setFExtraOvertime(""); setFExtraOther(""); setItems([]);
    setLineProductId(""); setLineChannel("catering"); setLineQty(""); setLineUnitPrice("");
  };

  const openCreate = () => {
    if (!selectedLineId) { toast.error("Seleccioná una línea de negocio"); return; }
    setEditingId(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (q: Quote) => {
    setEditingId(q.id);
    setFCustomerId(q.customerId ?? "");
    setFClientName(q.clientName ?? "");
    setFEventDate(q.eventDate ? q.eventDate.slice(0, 10) : "");
    setFSaleType(q.saleType ?? "");
    setFPeopleCount(q.peopleCount != null ? String(q.peopleCount) : "");
    setFDiscountPct(q.discountPct ? String(Math.round(q.discountPct * 1000) / 10) : "");
    setFExtraTransport(q.extraTransport ? String(q.extraTransport) : "");
    setFExtraPackaging(q.extraPackaging ? String(q.extraPackaging) : "");
    setFExtraStaff(q.extraStaff ? String(q.extraStaff) : "");
    setFExtraOvertime(q.extraOvertime ? String(q.extraOvertime) : "");
    setFExtraOther(q.extraOther ? String(q.extraOther) : "");
    setItems(
      q.items.map((i) => ({
        productId: i.productId,
        channel: i.channel,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        productName: i.product?.name ?? "—",
      })),
    );
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    resetForm();
  };

  const addLine = async () => {
    if (!lineProductId) { toast.error("Elegí un producto"); return; }
    const qty = Number(lineQty);
    if (!qty || qty <= 0) { toast.error("Ingresá una cantidad mayor a 0"); return; }
    const product = products.find((p) => p.id === lineProductId);
    let unitPrice = lineUnitPrice ? Number(lineUnitPrice) : NaN;
    if (!Number.isFinite(unitPrice)) {
      setLineLoading(true);
      unitPrice = await fetchSuggestedPrice(lineProductId, lineChannel);
      setLineLoading(false);
    }
    setItems((prev) => [...prev, { productId: lineProductId, channel: lineChannel, quantity: qty, unitPrice, productName: product?.name ?? "—" }]);
    setLineProductId(""); setLineQty(""); setLineUnitPrice("");
  };

  const removeLine = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotalProductos = items.reduce((sum, i) => sum + i.quantity * (i.unitPrice ?? 0), 0);
  const subtotalAgregados =
    (Number(fExtraTransport) || 0) + (Number(fExtraPackaging) || 0) + (Number(fExtraStaff) || 0) +
    (Number(fExtraOvertime) || 0) + (Number(fExtraOther) || 0);
  const totalAntesDescuento = subtotalProductos + subtotalAgregados;
  const discountFraction = (Number(fDiscountPct) || 0) / 100;
  const descuentoAplicado = totalAntesDescuento * discountFraction;
  const total = totalAntesDescuento - descuentoAplicado;
  const peopleCountNum = Number(fPeopleCount) || 0;
  const pricePerPerson = peopleCountNum > 0 ? total / peopleCountNum : null;

  const handleSubmit = async () => {
    if (!selectedLineId && !editingId) { toast.error("Seleccioná una línea de negocio"); return; }
    if (items.length === 0) { toast.error("Agregá al menos una línea de producto"); return; }
    setSubmitting(true);
    try {
      const payload = {
        customerId: fCustomerId || undefined,
        clientName: fClientName || undefined,
        eventDate: fEventDate || undefined,
        saleType: fSaleType || undefined,
        peopleCount: fPeopleCount ? Number(fPeopleCount) : undefined,
        discountPct: fDiscountPct ? Number(fDiscountPct) / 100 : undefined,
        extraTransport: fExtraTransport ? Number(fExtraTransport) : undefined,
        extraPackaging: fExtraPackaging ? Number(fExtraPackaging) : undefined,
        extraStaff: fExtraStaff ? Number(fExtraStaff) : undefined,
        extraOvertime: fExtraOvertime ? Number(fExtraOvertime) : undefined,
        extraOther: fExtraOther ? Number(fExtraOther) : undefined,
        items: items.map((i) => ({ productId: i.productId, channel: i.channel, quantity: i.quantity, unitPrice: i.unitPrice })),
      };
      if (editingId) {
        await apiClient.updateQuote(editingId, payload);
        toast.success("Presupuesto actualizado");
      } else {
        await apiClient.createQuote({ businessLineId: selectedLineId!, ...payload });
        toast.success("Presupuesto creado");
      }
      closeModal();
      void fetchQuotes();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar el presupuesto"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteQuote(id);
      toast.success("Presupuesto eliminado");
      setDeleteId(null);
      void fetchQuotes();
    } catch {
      toast.error("Error al eliminar presupuesto");
      setDeleteId(null);
    }
  };

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Presupuestos</h1>
        <button className="ha-btn ha-btn--primary" onClick={openCreate} disabled={!selectedLineId}>
          <Plus size={15} /> Nuevo presupuesto
        </button>
      </div>

      <ScreenInfoPanel title="¿Para qué sirve esta pantalla? Tocá acá para verlo">
        <div>
          <p style={{ margin: "0 0 8px 0" }}>
            Sirve para armar un precio y mandárselo a un cliente que te pidió un evento (por ejemplo, un catering). No descuenta stock ni genera un pedido — es solo el número que le pasás al cliente.
          </p>
          <ol style={{ margin: "0 0 10px 0", paddingLeft: 20 }}>
            <li>Tocá <strong>+ Nuevo presupuesto</strong>.</li>
            <li>Si el cliente ya está cargado, elegilo en <strong>Cliente existente</strong>. Si no, escribí su nombre en <strong>Nombre del cliente / evento</strong>.</li>
            <li>Cargá la fecha del evento y cuántas personas van.</li>
            <li>Para cada producto que va a llevar el evento: elegí el producto, el canal (normalmente <i>Catering</i>) y la cantidad, y tocá <strong>+ Agregar</strong>. El precio aparece solo — si necesitás ponerlo distinto, escribilo antes de tocar Agregar.</li>
            <li>Repetí el paso anterior por cada producto que lleve el evento.</li>
            <li>Si hay gastos extra (viaje, cajas, personal, horas extra), cargalos en <strong>Agregados opcionales</strong>.</li>
            <li>Si le hacés un descuento, escribí el porcentaje.</li>
            <li>Al final de todo, mirá el <strong>Total del presupuesto</strong> y el <strong>Precio por persona</strong>. Se calculan solos.</li>
            <li>Tocá <strong>Guardar</strong>.</li>
          </ol>
        </div>
      </ScreenInfoPanel>

      {loading ? (
        <Spinner />
      ) : quotes.length === 0 ? (
        <EmptyState title="Sin presupuestos" subtitle="Creá el primero con el botón de arriba." />
      ) : (
        <>
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Personas</th>
                  <th>Líneas</th>
                  <th>Total</th>
                  <th>$/persona</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 500 }}>{q.customer?.name ?? q.clientName ?? "—"}</td>
                    <td>{q.eventDate ? new Date(q.eventDate).toLocaleDateString("es-AR") : "—"}</td>
                    <td>{q.peopleCount ?? "—"}</td>
                    <td>{q.items.length}</td>
                    <td><b>{formatCurrency(q.totals.total)}</b></td>
                    <td>{q.totals.pricePerPerson != null ? formatCurrency(q.totals.pricePerPerson) : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button className="pc-btn pc-btn--ghost pc-btn--sm" onClick={() => openEdit(q)}>Editar</button>
                        <button
                          onClick={() => setDeleteId(q.id)}
                          style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 7, color: "var(--ha-red)", cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <Paginator
              page={pagination.page}
              totalPages={meta.totalPages}
              total={meta.total}
              label="presupuestos"
              onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
            />
          )}
        </>
      )}

      {modalOpen && (
        <div className="ha-modal-backdrop" onClick={closeModal}>
          <div className="ha-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">{editingId ? "Editar presupuesto" : "Nuevo presupuesto"}</span>
              <button className="ha-iconbtn" onClick={closeModal} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="ha-modal__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="ha-field">
                  <label className="ha-label">Cliente existente</label>
                  <select className="ha-input ha-select" value={fCustomerId} onChange={(e) => setFCustomerId(e.target.value)}>
                    <option value="">Sin cliente (usar nombre libre)</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="ha-field">
                  <label className="ha-label">Nombre del cliente / evento</label>
                  <input className="ha-input" placeholder="Ej: Cumpleaños Fede" value={fClientName} onChange={(e) => setFClientName(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div className="ha-field">
                  <label className="ha-label">Fecha</label>
                  <input type="date" className="ha-input" value={fEventDate} onChange={(e) => setFEventDate(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Tipo de venta</label>
                  <input className="ha-input" placeholder="Evento, catering…" value={fSaleType} onChange={(e) => setFSaleType(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Cantidad de personas</label>
                  <input type="number" className="ha-input" min={1} step={1} value={fPeopleCount} onChange={(e) => setFPeopleCount(e.target.value)} />
                </div>
              </div>

              <div className="rc-card__title" style={{ marginBottom: 10 }}>Productos</div>
              {items.length > 0 && (
                <div className="ps-tablewrap" style={{ marginBottom: 10 }}>
                  <table className="rc-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Canal</th>
                        <th>Cantidad</th>
                        <th>Precio unit.</th>
                        <th>Subtotal</th>
                        <th style={{ width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.productName}</td>
                          <td>{PRICE_TYPE_LABELS[item.channel]}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unitPrice ?? 0)}</td>
                          <td>{formatCurrency(item.quantity * (item.unitPrice ?? 0))}</td>
                          <td>
                            <button className="rc-xbtn" onClick={() => removeLine(i)} aria-label="Quitar línea"><X size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="rc-addrow" style={{ marginBottom: 16 }}>
                <div className="rc-ff" style={{ flex: 2, minWidth: 140 }}>
                  <label>Producto</label>
                  <select className="rc-fsel2" style={{ width: "100%" }} value={lineProductId} onChange={(e) => setLineProductId(e.target.value)}>
                    <option value="">Elegí un producto</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="rc-ff" style={{ width: 120 }}>
                  <label>Canal</label>
                  <select className="rc-fsel2" style={{ width: "100%" }} value={lineChannel} onChange={(e) => setLineChannel(e.target.value as PriceType)}>
                    {PRICE_TYPES.map((t) => <option key={t} value={t}>{PRICE_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="rc-ff" style={{ width: 90 }}>
                  <label>Cantidad</label>
                  <input type="number" className="rc-finput" style={{ width: "100%" }} min={0.001} step={0.5} value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                </div>
                <div className="rc-ff" style={{ width: 110 }}>
                  <label>Precio (opcional)</label>
                  <input type="number" className="rc-finput" style={{ width: "100%" }} min={0} step={0.01} placeholder="auto" value={lineUnitPrice} onChange={(e) => setLineUnitPrice(e.target.value)} />
                </div>
                <button className="pc-btn pc-btn--primary" style={{ height: 40, alignSelf: "flex-end" }} onClick={() => void addLine()} disabled={lineLoading}>
                  {lineLoading ? "…" : <><Plus size={14} /> Agregar</>}
                </button>
              </div>

              <div className="rc-card__title" style={{ marginBottom: 10 }}>Agregados opcionales</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div className="ha-field">
                  <label className="ha-label">Transporte</label>
                  <input type="number" className="ha-input" min={0} step={100} value={fExtraTransport} onChange={(e) => setFExtraTransport(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Packaging adicional</label>
                  <input type="number" className="ha-input" min={0} step={100} value={fExtraPackaging} onChange={(e) => setFExtraPackaging(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Personal adicional</label>
                  <input type="number" className="ha-input" min={0} step={100} value={fExtraStaff} onChange={(e) => setFExtraStaff(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Horas extra</label>
                  <input type="number" className="ha-input" min={0} step={100} value={fExtraOvertime} onChange={(e) => setFExtraOvertime(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Otros cargos</label>
                  <input type="number" className="ha-input" min={0} step={100} value={fExtraOther} onChange={(e) => setFExtraOther(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Descuento (%)</label>
                  <input type="number" className="ha-input" min={0} max={100} step={1} value={fDiscountPct} onChange={(e) => setFDiscountPct(e.target.value)} />
                </div>
              </div>

              <div className="rc-card__title" style={{ marginBottom: 10 }}>Resumen económico</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div className="rc-resrow"><span className="rc-resrow__n">Subtotal productos</span><span className="rc-resrow__v">{formatCurrency(subtotalProductos)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Subtotal agregados</span><span className="rc-resrow__v">{formatCurrency(subtotalAgregados)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Total antes de descuento</span><span className="rc-resrow__v">{formatCurrency(totalAntesDescuento)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Descuento aplicado</span><span className="rc-resrow__v">{formatCurrency(descuentoAplicado)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n"><b>Total del presupuesto</b></span><span className="rc-resrow__v"><b>{formatCurrency(total)}</b></span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Precio por persona</span><span className="rc-resrow__v">{pricePerPerson != null ? formatCurrency(pricePerPerson) : "—"}</span></div>
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeModal}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title="¿Eliminar presupuesto?"
          description="Esta acción no se puede deshacer."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void handleDelete(deleteId)}
        />
      )}
    </div>
  );
}
