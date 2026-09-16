"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import {
  ProductUnit,
  type Category,
  type CreateProductRequest,
  type IngredientEstado,
  type IngredientProfileRow,
  type PaginationMeta,
} from "@/lib/types";
import { Paginator } from "@/components/paginator";
import { Spinner } from "@/components/spinner";
import { Pencil, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const PRODUCT_UNIT_OPTIONS: { label: string; value: ProductUnit }[] = [
  { label: "Unidad", value: ProductUnit.UNIT },
  { label: "Kg", value: ProductUnit.KG },
  { label: "Gr", value: ProductUnit.G },
  { label: "Litro", value: ProductUnit.L },
  { label: "Ml", value: ProductUnit.ML },
];

const UNIT_SHORT_LABEL: Record<ProductUnit, string> = {
  [ProductUnit.UNIT]: "UN",
  [ProductUnit.KG]: "KG",
  [ProductUnit.G]: "GR",
  [ProductUnit.L]: "L",
  [ProductUnit.ML]: "ML",
};

const ESTADO_INFO: Record<IngredientEstado, { label: string; bg: string; color: string }> = {
  ACTIVO: { label: "Activo", bg: "var(--ha-green-soft)", color: "var(--ha-green)" },
  SIN_PRECIO: { label: "Sin precio", bg: "var(--ha-red-soft)", color: "var(--ha-red)" },
  SIN_USO: { label: "Sin uso", bg: "var(--ha-bg-raised)", color: "var(--ha-text-3)" },
  SIN_PRECIO_SIN_USO: { label: "Sin precio / sin uso", bg: "var(--ha-red-soft)", color: "var(--ha-red)" },
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function IngredientsPage() {
  return <IngredientsContent />;
}

function IngredientsContent() {
  const { selectedLineId } = useLineContext();

  const [rows, setRows] = useState<IngredientProfileRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 15 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientProfileRow | null>(null);
  const [fName, setFName] = useState("");
  const [fUnit, setFUnit] = useState<ProductUnit>(ProductUnit.KG);
  const [fCategoryId, setFCategoryId] = useState("");
  const [fPurchaseQty, setFPurchaseQty] = useState("");
  const [fPurchasePrice, setFPurchasePrice] = useState("");
  const [fSupplier, setFSupplier] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fNameErr, setFNameErr] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getIngredientProfiles(
        pagination.page,
        pagination.limit,
        selectedLineId ?? undefined,
        search || undefined,
        categoryFilter || undefined,
      );
      setRows(res.data);
      setMeta(res.meta);
    } catch {
      toast.error("Error al cargar ingredientes");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedLineId, search, categoryFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.getCategories(1, 100, selectedLineId ?? undefined);
      setCategories(res.data);
    } catch {
      // silent
    }
  }, [selectedLineId]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);
  useEffect(() => { void fetchCategories(); }, [fetchCategories]);
  useEffect(() => {
    if (drawerOpen) setTimeout(() => nameInputRef.current?.focus(), 80);
  }, [drawerOpen]);

  const resetForm = () => {
    setFName(""); setFUnit(ProductUnit.KG); setFCategoryId("");
    setFPurchaseQty(""); setFPurchasePrice(""); setFSupplier(""); setFNotes(""); setFNameErr(false);
  };

  const openCreate = () => {
    if (!selectedLineId) { toast.error("Seleccioná una línea de negocio"); return; }
    setEditing(null);
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (row: IngredientProfileRow) => {
    setEditing(row);
    setFName(row.name);
    setFUnit(row.unit);
    setFCategoryId(row.categoryId ?? "");
    setFPurchaseQty(row.purchaseQuantity != null ? String(row.purchaseQuantity) : "");
    setFPurchasePrice(row.purchasePrice != null ? String(row.purchasePrice) : "");
    setFSupplier(row.supplier ?? "");
    setFNotes(row.notes ?? "");
    setFNameErr(false);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    resetForm();
  };

  const handleSubmit = async () => {
    const trimmedName = fName.trim();
    if (!editing && !trimmedName) { setFNameErr(true); nameInputRef.current?.focus(); return; }
    if (!editing && !selectedLineId) { toast.error("Seleccioná una línea de negocio"); return; }
    setSubmitting(true);
    try {
      let productId = editing?.productId;
      if (!productId) {
        const data: CreateProductRequest = {
          businessLineId: selectedLineId!,
          name: trimmedName,
          unit: fUnit,
          categoryId: fCategoryId || undefined,
        };
        const created = await apiClient.createProduct(data);
        productId = created.id;
      } else if (editing && fCategoryId !== (editing.categoryId ?? "")) {
        await apiClient.updateProduct(productId, { categoryId: fCategoryId || undefined });
      }

      await apiClient.upsertIngredientProfile(productId, {
        purchaseQuantity: fPurchaseQty ? Number(fPurchaseQty) : undefined,
        purchasePrice: fPurchasePrice ? Number(fPurchasePrice) : undefined,
        supplier: fSupplier || undefined,
        notes: fNotes || undefined,
      });

      toast.success(editing ? "Ingrediente actualizado" : "Ingrediente creado");
      closeDrawer();
      void fetchRows();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar el ingrediente"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Ingredientes</h1>
        <button className="ha-btn ha-btn--primary" onClick={openCreate} disabled={!selectedLineId}>
          <Plus size={15} /> Nuevo ingrediente
        </button>
      </div>

      <div className="ha-filters" style={{ marginBottom: 16 }}>
        <div className="ha-filters__row">
          <div style={{ position: "relative", width: 280 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ha-text-3)" }} />
            <input
              className="ha-filter-input"
              style={{ width: "100%", paddingLeft: 32 }}
              placeholder="Buscar ingrediente…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPagination((p) => ({ ...p, page: 1 }));
                  setSearch(searchInput.trim());
                }
              }}
            />
          </div>
          <select
            className="ha-filter-input ha-select"
            style={{ width: 220, height: 36, padding: "0 30px 0 10px" }}
            value={categoryFilter}
            onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setCategoryFilter(e.target.value); }}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {meta && (
            <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ha-text-3)" }}>{meta.total} ingredientes</span>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">Sin ingredientes</p>
          <p className="ha-empty__s">Creá el primero con el botón de arriba.</p>
        </div>
      ) : (
        <>
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Cant. comprada</th>
                  <th>Precio compra</th>
                  <th>Costo unitario</th>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const estado = ESTADO_INFO[row.estado];
                  return (
                    <tr key={row.productId}>
                      <td style={{ fontWeight: 500 }}>{row.name}</td>
                      <td style={{ color: "var(--ha-text-2)" }}>{row.categoryName ?? "—"}</td>
                      <td className="ha-mono" style={{ color: "var(--ha-text-2)" }}>{UNIT_SHORT_LABEL[row.unit]}</td>
                      <td>{row.purchaseQuantity ?? "—"}</td>
                      <td>{row.purchasePrice != null ? formatCurrency(row.purchasePrice) : "—"}</td>
                      <td>{row.unitCost != null ? formatCurrency(row.unitCost) : "—"}</td>
                      <td style={{ color: "var(--ha-text-2)" }}>{row.supplier || "—"}</td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", padding: "2px 10px",
                          borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: estado.bg, color: estado.color,
                        }}>
                          {estado.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => openEdit(row)}
                          style={{ width: 32, height: 32, display: "inline-grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {meta && (
            <Paginator
              page={pagination.page}
              totalPages={meta.totalPages}
              total={meta.total}
              label="ingredientes"
              onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
            />
          )}
        </>
      )}

      {drawerOpen && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="ha-drawer" style={{ width: "min(90vw, 480px)" }}>
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">{editing ? "Editar ingrediente" : "Nuevo ingrediente"}</span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="ha-drawer__body">
              <div className="ha-formgrid">
                {!editing && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                    <div className="ha-field">
                      <label className="ha-label">Nombre <span style={{ color: "var(--ha-red)" }}>*</span></label>
                      <input
                        ref={nameInputRef}
                        className={`ha-input${fNameErr ? " ha-input--error" : ""}`}
                        placeholder="Nombre del ingrediente"
                        value={fName}
                        onChange={(e) => { setFName(e.target.value); if (fNameErr) setFNameErr(false); }}
                      />
                      {fNameErr && <span className="ha-error">El nombre es obligatorio.</span>}
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Unidad</label>
                      <select className="ha-input ha-select" value={fUnit} onChange={(e) => setFUnit(e.target.value as ProductUnit)}>
                        {PRODUCT_UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="ha-field">
                  <label className="ha-label">Categoría</label>
                  <select className="ha-input ha-select" value={fCategoryId} onChange={(e) => setFCategoryId(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="ha-field">
                    <label className="ha-label">Cantidad comprada</label>
                    <input type="number" className="ha-input" min={0} step={0.001} placeholder="Ej: 5" value={fPurchaseQty} onChange={(e) => setFPurchaseQty(e.target.value)} />
                  </div>
                  <div className="ha-field">
                    <label className="ha-label">Precio de compra ($)</label>
                    <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 21800" value={fPurchasePrice} onChange={(e) => setFPurchasePrice(e.target.value)} />
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ha-text-3)" }}>
                  El costo unitario se calcula como precio de compra ÷ cantidad comprada.
                </p>
                <div className="ha-field">
                  <label className="ha-label">Proveedor</label>
                  <input className="ha-input" placeholder="Proveedor (opcional)" value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Notas</label>
                  <textarea className="ha-textarea" rows={2} placeholder="Notas (opcional)" value={fNotes} onChange={(e) => setFNotes(e.target.value)} />
                </div>
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
    </div>
  );
}
