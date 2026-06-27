"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { Cost, CreateCostRequest, Product, UpdateCostRequest } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Paginator } from "@/components/paginator";
import { Spinner } from "@/components/spinner";
import { Check, History, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function CostsPage() {
  return <CostsContent />;
}

function CostsContent() {
  const { selectedLineId } = useLineContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [costs, setCosts] = useState<Cost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showActive, setShowActive] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  const [searchText, setSearchText] = useState(() => searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("search") ?? "");

  const [selectedCostIds, setSelectedCostIds] = useState<string[]>([]);
  const [bulkValue, setBulkValue] = useState("");

  // Inline replace popover
  const [popOpenId, setPopOpenId] = useState<string | null>(null);
  const [popValue, setPopValue] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fProductId, setFProductId] = useState("");
  const [fValue, setFValue] = useState("");

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
  }, [debouncedSearch, showActive]);

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
      const response = await apiClient.getProducts(
        1, 100, false, undefined, undefined, selectedLineId ?? undefined,
      );
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

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;
  const allPageSelected =
    costs.length > 0 && costs.filter((c) => !c.deactivatedAt).every((c) => selectedCostIds.includes(c.id));
  const somePageSelected = costs.some((c) => selectedCostIds.includes(c.id)) && !allPageSelected;

  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelectedCostIds((prev) => prev.filter((id) => !costs.find((c) => c.id === id)));
    } else {
      const pageIds = costs.filter((c) => !c.deactivatedAt).map((c) => c.id);
      setSelectedCostIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleRow = (id: string) => {
    setSelectedCostIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openPop = (id: string) => {
    setPopOpenId(id);
    setPopValue("");
  };

  const closePop = () => {
    setPopOpenId(null);
    setPopValue("");
  };

  const savePop = async (cost: Cost) => {
    const value = Number(popValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un costo válido"); return; }
    setSubmitting(true);
    try {
      await apiClient.replaceCost(cost.id, { value });
      toast.success("Costo actualizado");
      closePop();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setFlashId(cost.id);
      flashTimer.current = setTimeout(() => setFlashId(null), 1100);
      void fetchCosts();
    } catch {
      toast.error("Error al actualizar costo");
    } finally {
      setSubmitting(false);
    }
  };

  const applyBulk = async () => {
    const value = Number(bulkValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un costo válido"); return; }
    if (selectedCostIds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiClient.bulkReplaceCosts({ costIds: selectedCostIds, value });
      toast.success(`${res.count} costo(s) actualizado(s)`);
      setSelectedCostIds([]);
      setBulkValue("");
      void fetchCosts();
    } catch {
      toast.error("Error al actualizar costos");
    } finally {
      setSubmitting(false);
    }
  };

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

  const sheetCost = popOpenId ? costs.find((c) => c.id === popOpenId) : null;

  return (
    <div>
      <h1 className="pc-pagetitle">Costos</h1>

      {/* Filter bar */}
      <div className="pc-filter">
        <div className="pc-search">
          <Search size={17} />
          <input
            placeholder="Buscar producto…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <button
          className={`pc-btn${showActive ? " pc-btn--ghost" : " pc-btn--primary"}`}
          onClick={() => setShowActive((v) => !v)}
        >
          <History size={15} />
          {showActive ? "Ver historial" : "Ver activos"}
        </button>
        {showActive && (
          <button className="pc-btn pc-btn--primary" onClick={handleCreate}>
            + Nuevo costo
          </button>
        )}
        <span className="pc-count">
          {meta?.total ?? costs.length} {showActive ? "costos activos" : "costos archivados"}
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedCostIds.length > 0 && (
        <div className="pc-bulk">
          <span className="pc-bulk__t">
            <b>{selectedCostIds.length} costos seleccionados</b> · Nuevo costo:
          </span>
          <span className="pc-money">
            <input
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder="0"
              type="number"
              min={0}
            />
          </span>
          <button className="pc-btn pc-btn--primary" onClick={() => void applyBulk()} disabled={submitting}>
            Aplicar a todos
          </button>
          <button className="pc-btn pc-btn--ghost" onClick={() => { setSelectedCostIds([]); setBulkValue(""); }}>
            Cancelar selección
          </button>
        </div>
      )}

      {/* Main card */}
      {loading ? (
        <Spinner />
      ) : costs.length === 0 ? (
        <EmptyState title="No hay costos cargados todavía" />
      ) : (
        <div className="pc-card">
          {/* Desktop table */}
          <div className="pc-tablewrap">
            {popOpenId && (
              <div
                style={{ position: "fixed", inset: 0, zIndex: 15 }}
                onClick={closePop}
              />
            )}
            <table className="pc-table">
              <thead>
                <tr>
                  {showActive && (
                    <th>
                      <div
                        className={`pc-check${allPageSelected ? " on" : ""}`}
                        style={somePageSelected ? { opacity: 0.6 } : {}}
                        onClick={toggleAllPage}
                      >
                        {allPageSelected && <Check size={12} />}
                      </div>
                    </th>
                  )}
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Costo actual</th>
                  <th>Registrado</th>
                  {showActive && <th style={{ textAlign: "right" }}>Reemplazar</th>}
                </tr>
              </thead>
              <tbody>
                {costs.map((cost) => {
                  const isSelected = selectedCostIds.includes(cost.id);
                  const isDisabled = !!cost.deactivatedAt;
                  return (
                    <tr key={cost.id} className={isSelected ? "is-sel" : ""}>
                      {showActive && (
                        <td>
                          {!isDisabled && (
                            <div
                              className={`pc-check${isSelected ? " on" : ""}`}
                              onClick={() => toggleRow(cost.id)}
                            >
                              {isSelected && <Check size={12} />}
                            </div>
                          )}
                        </td>
                      )}
                      <td style={{ fontWeight: 500 }}>{cost.product?.name ?? "—"}</td>
                      <td className="pc-cat">{cost.product?.category?.name ?? "—"}</td>
                      <td>
                        <span className={`pc-price${flashId === cost.id ? " flash" : ""}`}>
                          {formatCurrency(cost.value)}
                        </span>
                      </td>
                      <td className="pc-vig">
                        {new Date(cost.createdAt).toLocaleDateString("es-AR")}
                      </td>
                      {showActive && (
                        <td style={{ textAlign: "right" }}>
                          {!isDisabled && (
                            <span className="pc-pop-wrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="pc-btn pc-btn--ghost pc-btn--sm"
                                onClick={() => popOpenId === cost.id ? closePop() : openPop(cost.id)}
                              >
                                Reemplazar
                              </button>
                              {popOpenId === cost.id && (
                                <div className="pc-pop">
                                  <div className="pc-pop__l">Nuevo costo para {cost.product?.name ?? "producto"}</div>
                                  <div className="pc-pop__money">
                                    <input
                                      value={popValue}
                                      onChange={(e) => setPopValue(e.target.value)}
                                      placeholder="0"
                                      type="number"
                                      min={0}
                                      // eslint-disable-next-line jsx-a11y/no-autofocus
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") void savePop(cost);
                                        if (e.key === "Escape") closePop();
                                      }}
                                    />
                                  </div>
                                  <div className="pc-pop__acts">
                                    <button className="pc-btn pc-btn--ghost pc-btn--sm" onClick={closePop}>
                                      Cancelar
                                    </button>
                                    <button
                                      className="pc-btn pc-btn--primary pc-btn--sm"
                                      onClick={() => void savePop(cost)}
                                      disabled={submitting}
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="pc-cardlist">
            {costs.map((cost) => {
              const isSelected = selectedCostIds.includes(cost.id);
              const isDisabled = !!cost.deactivatedAt;
              return (
                <div key={cost.id} className={`pc-pcard${isSelected ? " is-sel" : ""}`}>
                  <div className="pc-pcard__top">
                    <div>
                      <div className="pc-pcard__name">{cost.product?.name ?? "—"}</div>
                      <div className="pc-pcard__cat" style={{ marginTop: 4 }}>
                        {cost.product?.category?.name ?? "—"}
                      </div>
                    </div>
                    {showActive && !isDisabled && (
                      <div
                        className={`pc-check${isSelected ? " on" : ""}`}
                        onClick={() => toggleRow(cost.id)}
                      >
                        {isSelected && <Check size={12} />}
                      </div>
                    )}
                  </div>
                  <div className="pc-pcard__mid">
                    <span className={`pc-price pc-pcard__price${flashId === cost.id ? " flash" : ""}`}>
                      {formatCurrency(cost.value)}
                    </span>
                  </div>
                  <div className="pc-pcard__bot">
                    <span className="pc-vig">
                      Registrado {new Date(cost.createdAt).toLocaleDateString("es-AR")}
                    </span>
                    {showActive && !isDisabled && (
                      <button
                        className="pc-btn pc-btn--ghost pc-btn--sm"
                        onClick={() => openPop(cost.id)}
                      >
                        Reemplazar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && (
        <Paginator
          page={pagination.page}
          totalPages={totalPages}
          total={meta.total}
          label="costos"
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        />
      )}

      {/* Mobile bottom sheet for replace */}
      {sheetCost && (
        <>
          <div className="pc-sheet-back" onClick={closePop} />
          <div className="pc-sheet">
            <div className="pc-sheet__title">Reemplazar costo</div>
            <div className="pc-pop__l">
              Nuevo costo para {sheetCost.product?.name ?? "producto"}
            </div>
            <div className="pc-pop__money">
              <input
                value={popValue}
                onChange={(e) => setPopValue(e.target.value)}
                placeholder="0"
                type="number"
                min={0}
              />
            </div>
            <div className="pc-pop__acts">
              <button className="pc-btn pc-btn--ghost" onClick={closePop}>Cancelar</button>
              <button
                className="pc-btn pc-btn--primary"
                onClick={() => void savePop(sheetCost)}
                disabled={submitting}
              >
                Guardar
              </button>
            </div>
          </div>
        </>
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
                <input
                  type="number"
                  className="ha-input"
                  min={0}
                  step={0.01}
                  placeholder="Costo del producto"
                  value={fValue}
                  onChange={(e) => setFValue(e.target.value)}
                />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button
                className="ha-btn ha-btn--primary"
                onClick={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <ConfirmDialog
          title="¿Eliminar costo?"
          description="Esta acción no se puede deshacer."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void handleDelete(deleteId)}
        />
      )}
    </div>
  );
}
