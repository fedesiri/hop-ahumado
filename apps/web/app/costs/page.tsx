"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { Cost, CreateCostRequest, Product, UpdateCostRequest } from "@/lib/types";
import { Edit, RefreshCw, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function CostsPage() {
  return (
    <AppLayout>
      <CostsContent />
    </AppLayout>
  );
}

function CostsContent() {
  const { selectedLineId } = useLineContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Cost | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkReplaceModalOpen, setBulkReplaceModalOpen] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<Cost[] | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [selectedCostIds, setSelectedCostIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [showActive] = useState(true);
  const [searchText, setSearchText] = useState(() => searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("search") ?? "");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [fProductId, setFProductId] = useState("");
  const [fValue, setFValue] = useState("");
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

  const fetchCosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCosts(
        pagination.page,
        pagination.limit,
        undefined,
        showActive,
        debouncedSearch || undefined,
        selectedLineId ?? undefined,
      );
      setCosts(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar costos");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, showActive, debouncedSearch, selectedLineId]);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await apiClient.getProducts(1, 100, false, undefined, undefined, selectedLineId ?? undefined);
      setProducts(response.data);
    } catch {
      // silent
    }
  }, [selectedLineId]);

  useEffect(() => {
    void fetchCosts();
    void fetchProducts();
  }, [fetchCosts, fetchProducts]);

  useEffect(() => {
    setSelectedCostIds([]);
  }, [showActive]);

  const handleCreate = () => {
    setEditingId(null);
    setFProductId("");
    setFValue("");
    setModalOpen(true);
  };

  const handleEdit = (record: Cost) => {
    setEditingId(record.id);
    setFProductId(record.productId);
    setFValue(String(record.value));
    setModalOpen(true);
  };

  const openReplaceCost = (record: Cost) => {
    setReplaceTarget(record);
    setReplaceValue("");
    setReplaceModalOpen(true);
  };

  const bulkSelectionSummary = useMemo(() => {
    const selectedOnPage = costs.filter((c) => selectedCostIds.includes(c.id));
    const rowCount = selectedCostIds.length;
    const someSelectionOffPage = rowCount > 0 && selectedOnPage.length < rowCount;
    return { rowCount, someSelectionOffPage };
  }, [costs, selectedCostIds]);

  const openBulkReplace = async () => {
    if (selectedCostIds.length === 0) return;
    setBulkValue("");
    setBulkPreviewRows(null);
    setBulkReplaceModalOpen(true);
    setBulkPreviewLoading(true);
    const orderedUniqueIds = [...new Set(selectedCostIds)];
    try {
      const rows = await Promise.all(orderedUniqueIds.map((id) => apiClient.getCost(id)));
      setBulkPreviewRows(rows);
    } catch {
      toast.error("No se pudo cargar el detalle de los costos");
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleBulkReplaceSubmit = async () => {
    const value = Number(bulkValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un costo válido"); return; }
    if (selectedCostIds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiClient.bulkReplaceCosts({ costIds: selectedCostIds, value });
      toast.success(`Listo: ${res.count} producto${res.count === 1 ? "" : "s"} con nuevo costo; los anteriores quedaron archivados.`);
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
      setSelectedCostIds([]);
      void fetchCosts();
    } catch {
      toast.error("Error al actualizar costos");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaceSubmit = async () => {
    if (!replaceTarget) return;
    const value = Number(replaceValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un costo válido"); return; }
    setSubmitting(true);
    try {
      await apiClient.replaceCost(replaceTarget.id, { value });
      toast.success("Costo actualizado: el anterior quedó archivado.");
      setReplaceModalOpen(false);
      setReplaceTarget(null);
      void fetchCosts();
    } catch {
      toast.error("Error al actualizar costo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteCost(id);
      toast.success("Costo eliminado");
      setDeleteId(null);
      void fetchCosts();
    } catch {
      toast.error("Error al eliminar costo");
      setDeleteId(null);
    }
  };

  const handleSubmit = async () => {
    if (!fProductId) { toast.error("El producto es requerido"); return; }
    const value = Number(fValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("El costo es requerido"); return; }
    setSubmitting(true);
    try {
      const data: CreateCostRequest = { productId: fProductId, value };
      if (editingId) {
        await apiClient.updateCost(editingId, data as UpdateCostRequest);
        toast.success("Costo actualizado");
      } else {
        await apiClient.createCost(data);
        toast.success("Costo creado");
      }
      setModalOpen(false);
      void fetchCosts();
    } catch {
      toast.error("Error al guardar costo");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;
  const allPageSelected = costs.length > 0 && costs.every((c) => selectedCostIds.includes(c.id));
  const somePageSelected = costs.some((c) => selectedCostIds.includes(c.id)) && !allPageSelected;

  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelectedCostIds((prev) => prev.filter((id) => !costs.find((c) => c.id === id)));
    } else {
      const pageIds = costs.filter((c) => !c.deactivatedAt).map((c) => c.id);
      setSelectedCostIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleRow = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedCostIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Costos</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            type="search"
            className="ha-input"
            placeholder="Buscar por nombre, SKU o código de barras"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 280, width: "100%", minWidth: 160 }}
          />
          <button className="ha-btn ha-btn--primary" onClick={handleCreate}>
            + Nuevo costo
          </button>
        </div>
      </div>

      {showActive && bulkSelectionSummary.rowCount > 0 && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--ha-text)" }}>
            <strong>{bulkSelectionSummary.rowCount}</strong> costo(s) seleccionado(s)
            {bulkSelectionSummary.someSelectionOffPage && <span style={{ color: "var(--ha-text-3)" }}> (incluye otras páginas)</span>}.
          </span>
          <button className="ha-btn ha-btn--primary ha-btn--sm" onClick={() => void openBulkReplace()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={13} /> Mismo nuevo costo para todos
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : costs.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">No hay costos</p>
        </div>
      ) : (
        <div className="ha-table-wrap">
          <table className="ha-table">
            <thead>
              <tr>
                {showActive && (
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                      onChange={toggleAllPage}
                      style={{ accentColor: "var(--ha-amber)", cursor: "pointer" }}
                    />
                  </th>
                )}
                <th>Producto</th>
                <th>Costo</th>
                <th>Fecha de Creación</th>
                <th style={{ width: showActive ? 168 : 120 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => {
                const isDisabled = !!cost.deactivatedAt;
                const isSelected = selectedCostIds.includes(cost.id);
                return (
                  <tr key={cost.id}>
                    {showActive && (
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => toggleRow(cost.id, isDisabled)}
                          style={{ accentColor: "var(--ha-amber)", cursor: isDisabled ? "not-allowed" : "pointer" }}
                        />
                      </td>
                    )}
                    <td>{cost.product?.name || "—"}</td>
                    <td className="ha-mono">{formatCurrency(cost.value)}</td>
                    <td className="ha-mono" style={{ color: "var(--ha-text-3)" }}>{new Date(cost.createdAt).toLocaleDateString("es-AR")}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {showActive && !cost.deactivatedAt && (
                          <button
                            className="ha-btn ha-btn--secondary ha-btn--sm"
                            title="Archiva este costo y crea uno nuevo"
                            onClick={() => openReplaceCost(cost)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}
                        <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => handleEdit(cost)} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteId(cost.id)}
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

      {/* Pagination */}
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
              <span className="ha-modal__title">{editingId ? "Editar Costo" : "Nuevo Costo"}</span>
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
              <div className="ha-field">
                <label className="ha-label">Costo <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Costo del producto" value={fValue} onChange={(e) => setFValue(e.target.value)} />
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
              <span className="ha-modal__title">Nuevo costo (archivar el actual)</span>
              <button className="ha-iconbtn" onClick={() => { setReplaceModalOpen(false); setReplaceTarget(null); }} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <p style={{ marginBottom: 12, color: "var(--ha-text-2)", fontSize: 14 }}>
                <strong>{replaceTarget.product?.name ?? "Producto"}</strong> — costo vigente {formatCurrency(replaceTarget.value)} (solo referencia).
              </p>
              <p style={{ fontSize: 13, color: "var(--ha-text-3)", marginBottom: 16 }}>
                El costo vigente pasará al historial (archivado) y este valor será el único activo para el producto.
              </p>
              <div className="ha-field">
                <label className="ha-label">Nuevo costo por unidad <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej. 1520.50" value={replaceValue} onChange={(e) => setReplaceValue(e.target.value)} />
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
          <div className="ha-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Mismo nuevo costo para varios productos</span>
              <button className="ha-iconbtn" onClick={() => { setBulkReplaceModalOpen(false); setBulkPreviewRows(null); }} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <p style={{ marginBottom: 8, color: "var(--ha-text-2)", fontSize: 14 }}>
                Se archivan los costos vigentes de cada fila elegida y se crea <strong>un costo activo nuevo por producto</strong>, todos con el <strong>mismo valor por unidad</strong> que ingreses abajo.
              </p>
              <p style={{ fontSize: 13, color: "var(--ha-text-3)", marginBottom: 14 }}>
                Revisá el costo actual de cada ítem; al confirmar, todos pasan al mismo precio nuevo.
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
                          <th style={{ textAlign: "right" }}>Costo actual (unidad)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreviewRows.map((r) => (
                          <tr key={r.id}>
                            <td>{r.product?.name ?? "—"}</td>
                            <td className="ha-mono" style={{ textAlign: "right" }}>{formatCurrency(r.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
              <div className="ha-field">
                <label className="ha-label">Nuevo costo por unidad (aplica a todos) <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej. 1520.50" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
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
              <h3 className="ha-dialog__title">¿Eliminar costo?</h3>
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
