"use client";

import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { PRICE_TYPE_LABELS, PRICE_TYPES, type PriceType } from "@/lib/order-calculator/price-types";
import { toast } from "@/lib/toast";
import type { CreatePriceRequest, Price, Product, UpdatePriceRequest } from "@/lib/types";
import { Edit, RefreshCw, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatPriceListLabel(text: string | null | undefined): string {
  if (!text?.trim()) return "—";
  const t = text.trim().toLowerCase();
  if (PRICE_TYPES.includes(t as PriceType)) return PRICE_TYPE_LABELS[t as PriceType];
  return text.trim();
}

export default function PricesPage() {
  return <PricesContent />;
}

function PricesContent() {
  const { selectedLineId } = useLineContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prices, setPrices] = useState<Price[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Price | null>(null);
  const [bulkReplaceModalOpen, setBulkReplaceModalOpen] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<Price[] | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [selectedPriceIds, setSelectedPriceIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const showActive = true;
  const [searchText, setSearchText] = useState(() => searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("search") ?? "");
  const [listTypeFilter, setListTypeFilter] = useState<"" | PriceType>(
    () => (searchParams.get("listType") as PriceType) ?? "",
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [fProductId, setFProductId] = useState("");
  const [fValue, setFValue] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [bulkValue, setBulkValue] = useState("");

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchText.trim();
      setDebouncedSearch(trimmed);
      updateParams({ search: trimmed || null });
    }, 350);
    return () => clearTimeout(t);
  }, [searchText, updateParams]);

  useEffect(() => {
    setPagination((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [debouncedSearch]);

  useEffect(() => {
    setPagination((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [listTypeFilter]);

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPrices(
        pagination.page,
        pagination.limit,
        undefined,
        true,
        debouncedSearch || undefined,
        listTypeFilter ? listTypeFilter : undefined,
        selectedLineId ?? undefined,
      );
      setPrices(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar precios");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, listTypeFilter, selectedLineId]);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await apiClient.getProducts(1, 100, false, undefined, undefined, selectedLineId ?? undefined);
      setProducts(response.data);
    } catch {
      // silent
    }
  }, [selectedLineId]);

  useEffect(() => {
    void fetchPrices();
    void fetchProducts();
  }, [fetchPrices, fetchProducts]);

  const bulkSelectionSummary = useMemo(() => {
    const selectedOnPage = prices.filter((p) => selectedPriceIds.includes(p.id));
    const rowCount = selectedPriceIds.length;
    const someSelectionOffPage = rowCount > 0 && selectedOnPage.length < rowCount;
    return { rowCount, someSelectionOffPage };
  }, [prices, selectedPriceIds]);

  const handleCreate = () => {
    setEditingId(null);
    setFProductId("");
    setFValue("");
    setFDescription("");
    setModalOpen(true);
  };

  const handleEdit = (record: Price) => {
    setEditingId(record.id);
    setFProductId(record.productId);
    setFValue(String(record.value));
    setFDescription(record.description ?? "");
    setModalOpen(true);
  };

  const openReplacePrice = (record: Price) => {
    setReplaceTarget(record);
    setReplaceValue("");
    setReplaceModalOpen(true);
  };

  const handleReplaceSubmit = async () => {
    if (!replaceTarget) return;
    const value = Number(replaceValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un precio válido"); return; }
    setSubmitting(true);
    try {
      await apiClient.replacePrice(replaceTarget.id, { value });
      toast.success("Precio actualizado: el anterior quedó archivado.");
      setReplaceModalOpen(false);
      setReplaceTarget(null);
      void fetchPrices();
    } catch {
      toast.error("Error al actualizar precio");
    } finally {
      setSubmitting(false);
    }
  };

  const openBulkReplace = async () => {
    if (selectedPriceIds.length === 0) return;
    setBulkValue("");
    setBulkPreviewRows(null);
    setBulkReplaceModalOpen(true);
    setBulkPreviewLoading(true);
    const orderedUniqueIds = [...new Set(selectedPriceIds)];
    try {
      const rows = await Promise.all(orderedUniqueIds.map((id) => apiClient.getPrice(id)));
      setBulkPreviewRows(rows);
    } catch {
      toast.error("No se pudo cargar el detalle de los precios");
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleBulkReplaceSubmit = async () => {
    const value = Number(bulkValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un precio válido"); return; }
    if (selectedPriceIds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiClient.bulkReplacePrices({ priceIds: selectedPriceIds, value });
      toast.success(`Listo: ${res.count} producto(s)/lista(s) con nuevo precio; los anteriores quedaron archivados.`);
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
      setSelectedPriceIds([]);
      void fetchPrices();
    } catch {
      toast.error("Error al actualizar precios");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deletePrice(id);
      toast.success("Precio eliminado");
      setDeleteId(null);
      void fetchPrices();
    } catch {
      toast.error("Error al eliminar precio");
      setDeleteId(null);
    }
  };

  const handleSubmit = async () => {
    if (!fProductId) { toast.error("El producto es requerido"); return; }
    const value = Number(fValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("El valor es requerido"); return; }
    setSubmitting(true);
    try {
      const data: CreatePriceRequest = { productId: fProductId, value, description: fDescription || undefined };
      if (editingId) {
        await apiClient.updatePrice(editingId, data as UpdatePriceRequest);
        toast.success("Precio actualizado");
      } else {
        await apiClient.createPrice(data);
        toast.success("Precio creado");
      }
      setModalOpen(false);
      void fetchPrices();
    } catch {
      toast.error("Error al guardar precio");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;
  const allPageSelected = prices.length > 0 && prices.every((p) => selectedPriceIds.includes(p.id));
  const somePageSelected = prices.some((p) => selectedPriceIds.includes(p.id)) && !allPageSelected;

  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelectedPriceIds((prev) => prev.filter((id) => !prices.find((p) => p.id === id)));
    } else {
      const pageIds = prices.filter((p) => !p.deactivatedAt).map((p) => p.id);
      setSelectedPriceIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleRow = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedPriceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Precios</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            type="search"
            className="ha-input"
            placeholder="Buscar por nombre, SKU o código de barras"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 280, width: "100%", minWidth: 160 }}
          />
          <select
            className="ha-input"
            style={{ minWidth: 180, width: "auto" }}
            value={listTypeFilter}
            onChange={(e) => {
              const val = e.target.value as "" | PriceType;
              setListTypeFilter(val);
              updateParams({ listType: val || null });
            }}
          >
            <option value="">Lista de precio</option>
            {PRICE_TYPES.map((t) => <option key={t} value={t}>{PRICE_TYPE_LABELS[t]}</option>)}
          </select>
          <button className="ha-btn ha-btn--primary" onClick={handleCreate}>
            + Nuevo precio
          </button>
        </div>
      </div>

      <ScreenInfoPanel title="Tres listas para todos los productos">
        <>
          Podés cargar <strong>mayorista</strong>, <strong>minorista</strong> y <strong>fábrica</strong> para{" "}
          <strong>cualquier</strong> producto. En <strong>Nueva orden</strong> el selector usa esas etiquetas.
          Podés <strong>seleccionar varias filas</strong> y aplicar un <strong>mismo valor nuevo</strong>: cada fila conserva su lista.
        </>
      </ScreenInfoPanel>

      {showActive && bulkSelectionSummary.rowCount > 0 && (
        <div style={{ marginBottom: 16, marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--ha-text)" }}>
            <strong>{bulkSelectionSummary.rowCount}</strong> precio(s) seleccionado(s)
            {bulkSelectionSummary.someSelectionOffPage && <span style={{ color: "var(--ha-text-3)" }}> (incluye otras páginas)</span>}.
          </span>
          <button className="ha-btn ha-btn--primary ha-btn--sm" onClick={() => void openBulkReplace()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={13} /> Mismo nuevo precio para todos
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : prices.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">No hay precios cargados todavía</p>
        </div>
      ) : (
        <div className="ha-table-wrap">
          <table className="ha-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                    onChange={toggleAllPage}
                    style={{ accentColor: "var(--ha-amber)", cursor: "pointer" }}
                  />
                </th>
                <th>Producto</th>
                <th>Valor</th>
                <th>Lista / descripción</th>
                <th>Fecha de Creación</th>
                <th style={{ width: 188 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((price) => {
                const isDisabled = !!price.deactivatedAt;
                const isSelected = selectedPriceIds.includes(price.id);
                return (
                  <tr key={price.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleRow(price.id, isDisabled)}
                        style={{ accentColor: "var(--ha-amber)", cursor: isDisabled ? "not-allowed" : "pointer" }}
                      />
                    </td>
                    <td>{price.product?.name || "—"}</td>
                    <td className="ha-mono">{formatCurrency(price.value)}</td>
                    <td>{formatPriceListLabel(price.description)}</td>
                    <td className="ha-mono" style={{ color: "var(--ha-text-3)" }}>{new Date(price.createdAt).toLocaleDateString("es-AR")}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {showActive && !price.deactivatedAt && (
                          <button
                            className="ha-btn ha-btn--secondary ha-btn--sm"
                            title="Archiva este precio y crea uno nuevo"
                            onClick={() => openReplacePrice(price)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}
                        <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => handleEdit(price)} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteId(price.id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 6, color: "var(--ha-red)", cursor: "pointer", fontSize: 12 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <span style={{ color: "var(--ha-text-3)", fontSize: 13 }}>
            {meta.total} total · página {pagination.page} de {totalPages}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>‹</button>
            <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page >= totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>›</button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">{editingId ? "Editar Precio" : "Nuevo Precio"}</span>
              <button className="ha-iconbtn" onClick={() => setModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <div className="ha-field" style={{ marginBottom: 16 }}>
                <label className="ha-label">Producto <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <select className="ha-input" value={fProductId} onChange={(e) => setFProductId(e.target.value)}>
                  <option value="">Seleccioná un producto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 16 }}>
                <label className="ha-label">Valor <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Valor del producto" value={fValue} onChange={(e) => setFValue(e.target.value)} />
              </div>
              <div className="ha-field">
                <label className="ha-label">Lista de precio</label>
                <input
                  list="price-type-list"
                  className="ha-input"
                  placeholder="Elegí o escribí: mayorista, minorista, fabrica"
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                />
                <datalist id="price-type-list">
                  {PRICE_TYPES.map((t) => <option key={t} value={t}>{PRICE_TYPE_LABELS[t]} ({t})</option>)}
                </datalist>
                <p style={{ marginTop: 4, fontSize: 12, color: "var(--ha-text-3)" }}>
                  Usá mayorista, minorista o fabrica para que coincida con el selector de Nueva orden.
                </p>
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Modal */}
      {replaceModalOpen && replaceTarget && (
        <div className="ha-modal-backdrop" onClick={() => { setReplaceModalOpen(false); setReplaceTarget(null); }}>
          <div className="ha-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Nuevo precio (archivar el actual)</span>
              <button className="ha-iconbtn" onClick={() => { setReplaceModalOpen(false); setReplaceTarget(null); }} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <p style={{ marginBottom: 12, color: "var(--ha-text-2)", fontSize: 14 }}>
                <strong>{replaceTarget.product?.name ?? "Producto"}</strong> — {formatPriceListLabel(replaceTarget.description)} — precio vigente {formatCurrency(replaceTarget.value)} (referencia).
              </p>
              <p style={{ fontSize: 13, color: "var(--ha-text-3)", marginBottom: 16 }}>
                Se crea un registro nuevo con la <strong>misma lista</strong> ({formatPriceListLabel(replaceTarget.description)}).
              </p>
              <div className="ha-field">
                <label className="ha-label">Nuevo valor <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej. 2500" value={replaceValue} onChange={(e) => setReplaceValue(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => { setReplaceModalOpen(false); setReplaceTarget(null); }}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleReplaceSubmit()} disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Replace Modal */}
      {bulkReplaceModalOpen && (
        <div className="ha-modal-backdrop" onClick={() => { setBulkReplaceModalOpen(false); setBulkPreviewRows(null); }}>
          <div className="ha-modal" style={{ maxWidth: 780 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Mismo nuevo precio para varias filas</span>
              <button className="ha-iconbtn" onClick={() => { setBulkReplaceModalOpen(false); setBulkPreviewRows(null); }} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <p style={{ marginBottom: 8, color: "var(--ha-text-2)", fontSize: 14 }}>
                Cada fila tiene su <strong>lista</strong>. Se archivan los precios vigentes mostrados y se crea <strong>un precio nuevo por cada combinación producto + lista</strong>, todos con el <strong>mismo valor</strong>.
              </p>
              <p style={{ fontSize: 13, color: "var(--ha-text-3)", marginBottom: 14 }}>
                Ejemplo: si marcás &quot;Golden mayorista&quot; y &quot;Red ale mayorista&quot;, ambas pasan al mismo precio nuevo en <strong>mayorista</strong>.
              </p>
              <div style={{ marginBottom: 16 }}>
                {bulkPreviewLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
                  </div>
                ) : bulkPreviewRows && bulkPreviewRows.length > 0 ? (
                  <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--ha-border)", borderRadius: 8 }}>
                    <table className="ha-table" style={{ marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Lista</th>
                          <th style={{ textAlign: "right" }}>Precio actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreviewRows.map((r) => (
                          <tr key={r.id}>
                            <td>{r.product?.name ?? "—"}</td>
                            <td>{formatPriceListLabel(r.description)}</td>
                            <td className="ha-mono" style={{ textAlign: "right" }}>{formatCurrency(r.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
              <div className="ha-field">
                <label className="ha-label">Nuevo valor (aplica a todas las filas) <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej. 2500" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => { setBulkReplaceModalOpen(false); setBulkPreviewRows(null); }}>Cancelar</button>
              <button
                className="ha-btn ha-btn--primary"
                onClick={() => void handleBulkReplaceSubmit()}
                disabled={submitting || bulkPreviewLoading || !bulkPreviewRows?.length}
              >
                {submitting ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar precio?</h3>
              <p className="ha-dialog__sub">Esta acción no se puede deshacer.</p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={() => void handleDelete(deleteId)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
