"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import {
  normalizePriceListKey,
  PRICE_TYPES,
  type PriceType,
} from "@/lib/order-calculator/price-types";
import { toast } from "@/lib/toast";
import type { CreatePriceRequest, Price, Product, UpdatePriceRequest } from "@/lib/types";
import { Check, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const LIST_OPTIONS = [
  { value: "", label: "Todas las listas" },
  { value: "mayorista", label: "Mayorista" },
  { value: "minorista", label: "Minorista" },
  { value: "fabrica", label: "Fábrica" },
];

function pillInfo(description: string | null | undefined) {
  const key = normalizePriceListKey(description);
  if (key === "mayorista") return { cls: "pc-pill pc-pill--may", label: "May", full: "Lista Mayorista" };
  if (key === "minorista") return { cls: "pc-pill pc-pill--min", label: "Min", full: "Lista Minorista" };
  if (key === "fabrica") return { cls: "pc-pill pc-pill--fab", label: "Fab", full: "Lista Fábrica" };
  return { cls: "pc-pill", label: description?.substring(0, 3) ?? "—", full: description ?? "—" };
}

function formatPriceListLabel(description: string | null | undefined): string {
  const key = normalizePriceListKey(description);
  if (key === "mayorista") return "Mayorista";
  if (key === "minorista") return "Minorista";
  if (key === "fabrica") return "Fábrica";
  return description?.trim() || "—";
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
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  const [searchText, setSearchText] = useState(() => searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("search") ?? "");
  const [listTypeFilter, setListTypeFilter] = useState<"" | PriceType>(
    () => (searchParams.get("listType") as PriceType) ?? "",
  );

  const [selectedPriceIds, setSelectedPriceIds] = useState<string[]>([]);
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
  const [fDescription, setFDescription] = useState("");

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
  }, [debouncedSearch, listTypeFilter]);

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
      const response = await apiClient.getProducts(
        1, 100, false, undefined, undefined, selectedLineId ?? undefined,
      );
      setProducts(response.data);
    } catch {
      // silent
    }
  }, [selectedLineId]);

  useEffect(() => {
    void fetchPrices();
    void fetchProducts();
  }, [fetchPrices, fetchProducts]);

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

  const toggleRow = (id: string) => {
    setSelectedPriceIds((prev) =>
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

  const savePop = async (price: Price) => {
    const value = Number(popValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un precio válido"); return; }
    setSubmitting(true);
    try {
      await apiClient.replacePrice(price.id, { value });
      toast.success("Precio actualizado");
      closePop();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setFlashId(price.id);
      flashTimer.current = setTimeout(() => setFlashId(null), 1100);
      void fetchPrices();
    } catch {
      toast.error("Error al actualizar precio");
    } finally {
      setSubmitting(false);
    }
  };

  const applyBulk = async () => {
    const value = Number(bulkValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("Ingresá un precio válido"); return; }
    if (selectedPriceIds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiClient.bulkReplacePrices({ priceIds: selectedPriceIds, value });
      toast.success(`${res.count} precio(s) actualizado(s)`);
      setSelectedPriceIds([]);
      setBulkValue("");
      void fetchPrices();
    } catch {
      toast.error("Error al actualizar precios");
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleSubmit = async () => {
    if (!fProductId) { toast.error("El producto es requerido"); return; }
    const value = Number(fValue);
    if (!Number.isFinite(value) || value < 0) { toast.error("El valor es requerido"); return; }
    setSubmitting(true);
    try {
      const data: CreatePriceRequest = {
        productId: fProductId,
        value,
        description: fDescription || undefined,
      };
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

  const sheetPrice = popOpenId ? prices.find((p) => p.id === popOpenId) : null;

  return (
    <div>
      <h1 className="pc-pagetitle">Precios</h1>

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
        <select
          className="pc-select"
          value={listTypeFilter}
          onChange={(e) => {
            const val = e.target.value as "" | PriceType;
            setListTypeFilter(val);
            updateParams({ listType: val || null });
          }}
        >
          {LIST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button className="pc-btn pc-btn--primary pc-btn--sm" onClick={handleCreate}>
          + Nuevo precio
        </button>
        <span className="pc-count">
          {meta?.total ?? prices.length} precios activos
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedPriceIds.length > 0 && (
        <div className="pc-bulk">
          <span className="pc-bulk__t">
            <b>{selectedPriceIds.length} precios seleccionados</b> · Nuevo precio:
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
          <button className="pc-btn pc-btn--ghost" onClick={() => { setSelectedPriceIds([]); setBulkValue(""); }}>
            Cancelar selección
          </button>
        </div>
      )}

      {/* Main card */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)",
            animation: "ha-spin .7s linear infinite",
          }} />
        </div>
      ) : prices.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">No hay precios cargados todavía</p>
        </div>
      ) : (
        <div className="pc-card">
          {/* Desktop table */}
          <div className="pc-tablewrap">
            {/* Invisible backdrop to close popover when clicking outside */}
            {popOpenId && (
              <div
                style={{ position: "fixed", inset: 0, zIndex: 15 }}
                onClick={closePop}
              />
            )}
            <table className="pc-table">
              <thead>
                <tr>
                  <th>
                    <div
                      className={`pc-check${allPageSelected ? " on" : ""}`}
                      style={somePageSelected ? { opacity: 0.6 } : {}}
                      onClick={toggleAllPage}
                    >
                      {allPageSelected && <Check size={12} />}
                    </div>
                  </th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Lista</th>
                  <th>Precio actual</th>
                  <th>Vigente desde</th>
                  <th style={{ textAlign: "right" }}>Reemplazar</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((price) => {
                  const isSelected = selectedPriceIds.includes(price.id);
                  const pill = pillInfo(price.description);
                  return (
                    <tr key={price.id} className={isSelected ? "is-sel" : ""}>
                      <td>
                        <div
                          className={`pc-check${isSelected ? " on" : ""}`}
                          onClick={() => toggleRow(price.id)}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{price.product?.name ?? "—"}</td>
                      <td className="pc-cat">{price.product?.category?.name ?? "—"}</td>
                      <td><span className={pill.cls}>{pill.label}</span></td>
                      <td>
                        <span className={`pc-price${flashId === price.id ? " flash" : ""}`}>
                          {formatCurrency(price.value)}
                        </span>
                      </td>
                      <td className="pc-vig">
                        {new Date(price.createdAt).toLocaleDateString("es-AR")}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="pc-pop-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="pc-btn pc-btn--ghost pc-btn--sm"
                            onClick={() => popOpenId === price.id ? closePop() : openPop(price.id)}
                          >
                            Reemplazar
                          </button>
                          {popOpenId === price.id && (
                            <div className="pc-pop">
                              <div className="pc-pop__l">Nuevo precio ({pill.full})</div>
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
                                    if (e.key === "Enter") void savePop(price);
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
                                  onClick={() => void savePop(price)}
                                  disabled={submitting}
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="pc-cardlist">
            {prices.map((price) => {
              const isSelected = selectedPriceIds.includes(price.id);
              const pill = pillInfo(price.description);
              return (
                <div key={price.id} className={`pc-pcard${isSelected ? " is-sel" : ""}`}>
                  <div className="pc-pcard__top">
                    <div>
                      <div className="pc-pcard__name">{price.product?.name ?? "—"}</div>
                      <span className={pill.cls} style={{ marginTop: 6, display: "inline-flex" }}>
                        {pill.label}
                      </span>
                    </div>
                    <div
                      className={`pc-check${isSelected ? " on" : ""}`}
                      onClick={() => toggleRow(price.id)}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                  </div>
                  <div className="pc-pcard__mid">
                    <span className={`pc-price pc-pcard__price${flashId === price.id ? " flash" : ""}`}>
                      {formatCurrency(price.value)}
                    </span>
                    <span className="pc-pcard__cat">{price.product?.category?.name ?? "—"}</span>
                  </div>
                  <div className="pc-pcard__bot">
                    <span className="pc-vig">
                      Vigente desde {new Date(price.createdAt).toLocaleDateString("es-AR")}
                    </span>
                    <button
                      className="pc-btn pc-btn--ghost pc-btn--sm"
                      onClick={() => openPop(price.id)}
                    >
                      Reemplazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div style={{
          display: "flex", justifyContent: "flex-end", alignItems: "center",
          gap: 12, marginTop: 16, flexWrap: "wrap",
        }}>
          <span style={{ color: "var(--ha-text-3)", fontSize: 13 }}>
            {meta.total} total · página {pagination.page} de {totalPages}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="pc-btn pc-btn--ghost pc-btn--sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >‹</button>
            <button
              className="pc-btn pc-btn--ghost pc-btn--sm"
              disabled={pagination.page >= totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >›</button>
          </div>
        </div>
      )}

      {/* Mobile bottom sheet for replace */}
      {sheetPrice && (
        <>
          <div className="pc-sheet-back" onClick={closePop} />
          <div className="pc-sheet">
            <div className="pc-sheet__title">Reemplazar precio</div>
            <div className="pc-pop__l">
              Nuevo precio ({pillInfo(sheetPrice.description).full})
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
                onClick={() => void savePop(sheetPrice)}
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
                <input
                  type="number"
                  className="ha-input"
                  min={0}
                  step={0.01}
                  placeholder="Valor del producto"
                  value={fValue}
                  onChange={(e) => setFValue(e.target.value)}
                />
              </div>
              <div className="ha-field">
                <label className="ha-label">Lista de precio</label>
                <select
                  className="ha-input"
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                >
                  <option value="">Sin lista</option>
                  {PRICE_TYPES.map((t) => (
                    <option key={t} value={t}>{formatPriceListLabel(t)}</option>
                  ))}
                </select>
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
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar precio?</h3>
              <p className="ha-dialog__sub">Esta acción no se puede deshacer.</p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button
                className="ha-btn ha-btn--destructive"
                onClick={() => void handleDelete(deleteId)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
