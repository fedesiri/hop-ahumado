"use client";

import { AppLayout } from "@/components/app-layout";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import {
  ProductUnit,
  type Category,
  type CreateCostRequest,
  type CreatePriceRequest,
  type CreateProductRequest,
  type PaginationMeta,
  type Product,
  type UpdateProductRequest,
} from "@/lib/types";
import { toast } from "@/lib/toast";
import { Edit2, Filter, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PRODUCT_UNIT_OPTIONS: { label: string; value: ProductUnit }[] = [
  { label: "Unidad", value: ProductUnit.UNIT },
  { label: "Kg", value: ProductUnit.KG },
  { label: "Gr", value: ProductUnit.G },
  { label: "Litro", value: ProductUnit.L },
  { label: "Ml", value: ProductUnit.ML },
];

const UNIT_SHORT_LABEL: Record<ProductUnit, string> = {
  [ProductUnit.UNIT]: "un",
  [ProductUnit.KG]: "kg",
  [ProductUnit.G]: "gr",
  [ProductUnit.L]: "l",
  [ProductUnit.ML]: "ml",
};

export default function ProductsPage() {
  return (
    <AppLayout>
      <ProductsContent />
    </AppLayout>
  );
}

function ProductsContent() {
  const { selectedLineId } = useLineContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [reactivateId, setReactivateId] = useState<string | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(
    () => searchParams.get("showDeactivated") === "true",
  );
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [searchInput, setSearchInput] = useState(() => searchParams.get("search") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string>(
    () => searchParams.get("category") ?? "",
  );

  const [fname, setFname] = useState("");
  const [funit, setFunit] = useState<ProductUnit>(ProductUnit.UNIT);
  const [fcategoryId, setFcategoryId] = useState("");
  const [fsku, setFsku] = useState("");
  const [fbarcode, setFbarcode] = useState("");
  const [fdescription, setFdescription] = useState("");
  const [fnameErr, setFnameErr] = useState(false);
  const [fstock, setFstock] = useState("");
  const [fcostValue, setFcostValue] = useState("");
  const [fpriceMayorista, setFpriceMayorista] = useState("");
  const [fpriceMinorista, setFpriceMinorista] = useState("");
  const [fpriceFabrica, setFpriceFabrica] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const activeFilterCount = (categoryFilter ? 1 : 0) + (showDeactivated ? 1 : 0);

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

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProducts(
        pagination.page,
        pagination.limit,
        showDeactivated,
        search || undefined,
        categoryFilter || undefined,
        selectedLineId ?? undefined,
      );
      setProducts(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, showDeactivated, search, categoryFilter, selectedLineId]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.getCategories(1, 100, selectedLineId ?? undefined);
      setCategories(response.data);
    } catch {
      // silent
    }
  }, [selectedLineId]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    if (drawerOpen) setTimeout(() => nameInputRef.current?.focus(), 80);
  }, [drawerOpen]);

  const resetForm = () => {
    setFname(""); setFunit(ProductUnit.UNIT); setFcategoryId("");
    setFsku(""); setFbarcode(""); setFdescription(""); setFnameErr(false);
    setFstock(""); setFcostValue(""); setFpriceMayorista(""); setFpriceMinorista(""); setFpriceFabrica("");
  };

  const openCreate = () => {
    if (!selectedLineId) { toast.error("Seleccioná una línea de negocio"); return; }
    setEditingId(null);
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (record: Product) => {
    setEditingId(record.id);
    setFname(record.name);
    setFunit(record.unit);
    setFcategoryId(record.categoryId ?? "");
    setFsku(record.sku ?? "");
    setFbarcode(record.barcode ?? "");
    setFdescription(record.description ?? "");
    setFnameErr(false);
    setFstock(String(record.stock ?? ""));
    setFcostValue(""); setFpriceMayorista(""); setFpriceMinorista(""); setFpriceFabrica("");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleSubmit = async () => {
    const trimmedName = fname.trim();
    if (!trimmedName) { setFnameErr(true); nameInputRef.current?.focus(); return; }
    if (!selectedLineId && !editingId) { toast.error("Seleccioná una línea de negocio"); return; }
    setSubmitting(true);
    try {
      const data: CreateProductRequest = {
        businessLineId: selectedLineId!,
        name: trimmedName,
        unit: funit,
        description: fdescription || undefined,
        categoryId: fcategoryId || undefined,
        sku: fsku || undefined,
        barcode: fbarcode || undefined,
        stock: fstock ? Number(fstock) : 0,
      };

      if (editingId) {
        await apiClient.updateProduct(editingId, data as UpdateProductRequest);
        toast.success("Producto actualizado");
      } else {
        const created = await apiClient.createProduct(data);

        const costValue = fcostValue ? Number(fcostValue) : undefined;
        if (typeof costValue === "number" && Number.isFinite(costValue)) {
          const costData: CreateCostRequest = { productId: created.id, value: costValue };
          await apiClient.createCost(costData);
        }

        const priceFields: { val: string; description: "mayorista" | "minorista" | "fabrica" }[] = [
          { val: fpriceMayorista, description: "mayorista" },
          { val: fpriceMinorista, description: "minorista" },
          { val: fpriceFabrica, description: "fabrica" },
        ];
        for (const pf of priceFields) {
          const raw = pf.val ? Number(pf.val) : undefined;
          if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
          const priceData: CreatePriceRequest = { productId: created.id, value: raw, description: pf.description };
          await apiClient.createPrice(priceData);
        }

        toast.success("Producto creado");
      }
      closeDrawer();
      fetchProducts();
    } catch {
      toast.error("Error al guardar producto");
    } finally {
      setSubmitting(false);
    }
  };

  const stockColor = (stock: number) => {
    const n = Number(stock);
    if (n < 5) return { bg: "var(--ha-red-soft)", color: "var(--ha-red)" };
    if (n < 10) return { bg: "rgba(251,146,60,0.16)", color: "var(--ha-orange)" };
    return { bg: "var(--ha-green-soft)", color: "var(--ha-green)" };
  };

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Productos</h1>
        <button className="ha-btn ha-btn--primary ha-desktop-only" onClick={openCreate} disabled={!selectedLineId}>
          <Plus size={15} /> Nuevo producto
        </button>
      </div>

      <ScreenInfoPanel title="¿Qué número va en «stock»?">
        <div>
          <p style={{ margin: "0 0 8px 0" }}>
            Es <strong>cuánto tenés disponible</strong> de ese producto, en la unidad que elijas para él.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Venta por unidad</strong> (ej. cerveza): stock = cantidad de unidades.</li>
            <li><strong>Venta por peso/volumen</strong> (ej. tomate en kg): stock = kg o litros, decimales válidos.</li>
          </ul>
          <p style={{ margin: "8px 0 0" }}>Usá la <strong>misma unidad</strong> en movimientos y recetas.</p>
        </div>
      </ScreenInfoPanel>

      {/* Filters */}
      <div className="ha-filters" style={{ marginBottom: 16 }}>
        <div className="ha-filters__row">
          <input
            className="ha-filter-input"
            style={{ flex: 1 }}
            placeholder="Buscar por nombre, SKU o código…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const trimmed = searchInput.trim();
                setPagination((p) => ({ ...p, page: 1 }));
                setSearch(trimmed);
                updateParams({ search: trimmed || null });
              }
            }}
          />
          {/* Desktop: inline filters */}
          <select
            className="ha-filter-input ha-select ha-desktop-only"
            style={{ width: 200, height: 36, padding: "0 30px 0 10px", flex: "none" }}
            value={categoryFilter}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setCategoryFilter(e.target.value);
              updateParams({ category: e.target.value || null });
            }}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            className={`ha-btn ha-btn--sm ha-desktop-only ${showDeactivated ? "ha-btn--primary" : "ha-btn--secondary"}`}
            style={{ flex: "none" }}
            onClick={() => {
              setPagination((p) => ({ ...p, page: 1 }));
              const next = !showDeactivated;
              setShowDeactivated(next);
              updateParams({ showDeactivated: next ? "true" : null });
            }}
          >
            {showDeactivated ? "Ver activos" : "Ver desactivados"}
          </button>
          {/* Mobile: Filtros button */}
          <button
            className="ha-btn ha-btn--secondary ha-btn--sm ha-mobile-only"
            style={{ flex: "none", gap: 6, display: "flex", alignItems: "center" }}
            onClick={() => setFilterSheetOpen(true)}
          >
            <Filter size={14} />
            Filtros
            {activeFilterCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: "50%",
                background: "var(--ha-amber)", color: "#0f1117",
                fontSize: 11, fontWeight: 700,
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : products.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">Sin productos</p>
          <p className="ha-empty__s">{search ? "Ningún producto coincide con la búsqueda." : "Creá el primer producto."}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th style={{ textAlign: "right", width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const sc = stockColor(p.stock);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        {p.sku && (
                          <div className="ha-mono" style={{ fontSize: 11, color: "var(--ha-text-3)", marginTop: 2 }}>
                            {p.sku}
                          </div>
                        )}
                      </td>
                      <td style={{ color: "var(--ha-text-2)" }}>{p.category?.name || "—"}</td>
                      <td>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>
                          {formatQuantity(p.stock)} {UNIT_SHORT_LABEL[p.unit] ?? ""}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <button
                            onClick={() => openEdit(p)}
                            style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                          >
                            <Edit2 size={14} />
                          </button>
                          {showDeactivated ? (
                            <button
                              onClick={() => { setReactivateId(p.id); setReactivateTarget(p.name); }}
                              style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                              title="Reactivar"
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => { setDeleteId(p.id); setDeleteTarget(p.name); }}
                              style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 7, color: "var(--ha-red)", cursor: "pointer" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="ha-cardlist">
            {products.map((p) => {
              const sc = stockColor(p.stock);
              return (
                <div key={p.id} className="ha-ordcard">
                  <div className="ha-ordcard__top">
                    <div>
                      <div className="ha-ordcard__name">{p.name}</div>
                      {(p.sku || p.category?.name) && (
                        <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 12, color: "var(--ha-text-3)" }}>
                          {p.sku && <span className="ha-mono">{p.sku}</span>}
                          {p.category?.name && <span>{p.category.name}</span>}
                        </div>
                      )}
                    </div>
                    <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, flexShrink: 0 }}>
                      {formatQuantity(p.stock)} {UNIT_SHORT_LABEL[p.unit] ?? ""}
                    </span>
                  </div>
                  <div className="ha-ordcard__actions">
                    <button className="ha-actbtn" onClick={() => openEdit(p)}>
                      <Edit2 size={15} />
                    </button>
                    {showDeactivated ? (
                      <button className="ha-actbtn" onClick={() => { setReactivateId(p.id); setReactivateTarget(p.name); }}>
                        <RotateCcw size={15} />
                      </button>
                    ) : (
                      <button
                        className="ha-actbtn"
                        onClick={() => { setDeleteId(p.id); setDeleteTarget(p.name); }}
                        style={{ borderColor: "var(--ha-red)", color: "var(--ha-red)" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button
                className="ha-btn ha-btn--secondary ha-btn--sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                Anterior
              </button>
              <span style={{ fontSize: 13, color: "var(--ha-text-3)" }}>
                Página {pagination.page} de {meta.totalPages}
              </span>
              <button
                className="ha-btn ha-btn--secondary ha-btn--sm"
                disabled={pagination.page >= meta.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* FAB — mobile */}
      <button className="ha-fab" onClick={openCreate} aria-label="Nuevo producto">
        <Plus size={24} />
      </button>

      {/* Mobile filter sheet */}
      {filterSheetOpen && (
        <>
          <div className="ha-sheet-back" onClick={() => setFilterSheetOpen(false)} />
          <div className="ha-sheet">
            <div className="ha-sheet__handle" />
            <div className="ha-sheet__head">
              <span className="ha-sheet__title">Filtros</span>
              <button className="ha-iconbtn" onClick={() => setFilterSheetOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="ha-sheet__body">
              <div className="ha-field">
                <label className="ha-label">Categoría</label>
                <select
                  className="ha-input ha-select"
                  value={categoryFilter}
                  onChange={(e) => {
                    setPagination((p) => ({ ...p, page: 1 }));
                    setCategoryFilter(e.target.value);
                    updateParams({ category: e.target.value || null });
                  }}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
                <input
                  type="checkbox"
                  id="chk-deactivated"
                  checked={showDeactivated}
                  onChange={(e) => {
                    setPagination((p) => ({ ...p, page: 1 }));
                    setShowDeactivated(e.target.checked);
                    updateParams({ showDeactivated: e.target.checked ? "true" : null });
                  }}
                />
                <label htmlFor="chk-deactivated" className="ha-label" style={{ margin: 0 }}>
                  Mostrar productos desactivados
                </label>
              </div>
            </div>
            <div className="ha-sheet__foot">
              <button className="ha-btn ha-btn--primary" onClick={() => setFilterSheetOpen(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="ha-drawer" style={{ width: "min(90vw, 480px)" }}>
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">{editingId ? "Editar producto" : "Nuevo producto"}</span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="ha-drawer__body">
              <div className="ha-formgrid">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                  <div className="ha-field">
                    <label className="ha-label">Nombre <span style={{ color: "var(--ha-red)" }}>*</span></label>
                    <input
                      ref={nameInputRef}
                      className={`ha-input${fnameErr ? " ha-input--error" : ""}`}
                      placeholder="Nombre del producto"
                      value={fname}
                      onChange={(e) => { setFname(e.target.value); if (fnameErr) setFnameErr(false); }}
                    />
                    {fnameErr && <span className="ha-error">El nombre es obligatorio.</span>}
                  </div>
                  <div className="ha-field">
                    <label className="ha-label">Unidad</label>
                    <select className="ha-input ha-select" value={funit} onChange={(e) => setFunit(e.target.value as ProductUnit)}>
                      {PRODUCT_UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="ha-field">
                    <label className="ha-label">Categoría</label>
                    <select className="ha-input ha-select" value={fcategoryId} onChange={(e) => setFcategoryId(e.target.value)}>
                      <option value="">Sin categoría</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="ha-field">
                    <label className="ha-label">Stock inicial</label>
                    <input type="number" className="ha-input" placeholder="Ej. 12 o 10.5" min={0} step={0.01} value={fstock} onChange={(e) => setFstock(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="ha-field">
                    <label className="ha-label">SKU</label>
                    <input className="ha-input" placeholder="SKU" value={fsku} onChange={(e) => setFsku(e.target.value)} />
                  </div>
                  <div className="ha-field">
                    <label className="ha-label">Código de barras</label>
                    <input className="ha-input" placeholder="Código de barras" value={fbarcode} onChange={(e) => setFbarcode(e.target.value)} />
                  </div>
                </div>

                <div className="ha-field">
                  <label className="ha-label">Descripción</label>
                  <textarea className="ha-textarea" placeholder="Descripción (opcional)" rows={2} value={fdescription} onChange={(e) => setFdescription(e.target.value)} />
                </div>

                {!editingId && (
                  <div style={{ border: "1px solid var(--ha-border)", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: "0.02em", marginBottom: 14, color: "var(--ha-text)" }}>
                      Costo y precios
                    </div>
                    <div className="ha-formgrid">
                      <div className="ha-field">
                        <label className="ha-label">Costo por unidad</label>
                        <input type="number" className="ha-input" placeholder="Ej: 1200" min={0} step={0.01} value={fcostValue} onChange={(e) => setFcostValue(e.target.value)} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div className="ha-field">
                          <label className="ha-label">Mayorista</label>
                          <input type="number" className="ha-input" placeholder="Precio" min={0} step={0.01} value={fpriceMayorista} onChange={(e) => setFpriceMayorista(e.target.value)} />
                        </div>
                        <div className="ha-field">
                          <label className="ha-label">Minorista</label>
                          <input type="number" className="ha-input" placeholder="Precio" min={0} step={0.01} value={fpriceMinorista} onChange={(e) => setFpriceMinorista(e.target.value)} />
                        </div>
                        <div className="ha-field">
                          <label className="ha-label">Fábrica</label>
                          <input type="number" className="ha-input" placeholder="Precio" min={0} step={0.01} value={fpriceFabrica} onChange={(e) => setFpriceFabrica(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--ha-text-3)" }}>
                      Si dejás algún precio vacío, podés cargarlo después en la pantalla de <strong style={{ color: "var(--ha-text-2)" }}>Precios</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="ha-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeDrawer}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar producto?</h3>
              <p className="ha-dialog__sub">Esta acción no puede deshacerse.</p>
            </div>
            <div className="ha-dialog__body">
              <p style={{ color: "var(--ha-text-2)", margin: 0, fontSize: 14 }}>
                Se eliminará <strong style={{ color: "var(--ha-text)" }}>{deleteTarget}</strong>.
              </p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={async () => {
                try {
                  await apiClient.deleteProduct(deleteId!);
                  toast.success("Producto eliminado");
                  setDeleteId(null);
                  fetchProducts();
                } catch {
                  toast.error("Error al eliminar producto");
                  setDeleteId(null);
                }
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate dialog */}
      {reactivateId && (
        <div className="ha-dialog-back" onClick={() => setReactivateId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">Reactivar producto</h3>
              <p className="ha-dialog__sub">Vuelve al listado de activos y a las ventas.</p>
            </div>
            <div className="ha-dialog__body">
              <p style={{ color: "var(--ha-text-2)", margin: 0, fontSize: 14 }}>
                Las cantidades en stock que tenía <strong style={{ color: "var(--ha-text)" }}>{reactivateTarget}</strong> al desactivarse se conservan.
              </p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setReactivateId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={async () => {
                try {
                  await apiClient.updateProduct(reactivateId!, { deactivationDate: null });
                  toast.success("Producto reactivado");
                  setReactivateId(null);
                  fetchProducts();
                } catch {
                  toast.error("Error al reactivar producto");
                  setReactivateId(null);
                }
              }}>Reactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
