"use client";

import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import {
  ProductUnit,
  type CreateCostRequest,
  type CreatePriceRequest,
  type CreateProductRequest,
  type CreateRecipeItemRequest,
  type Product,
  type RecipeItem,
  type UpdateRecipeItemRequest,
} from "@/lib/types";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function ingredientAmountPerKgOfFinal(ingredientPerFinalUnit: number, finalUnit: ProductUnit): number | null {
  if (finalUnit === ProductUnit.KG) return ingredientPerFinalUnit;
  if (finalUnit === ProductUnit.G) return ingredientPerFinalUnit * 1000;
  return null;
}

function formatRecipeAmount(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function RecipesPage() {
  return <RecipesContent />;
}

function RecipesContent() {
  const { selectedLineId } = useLineContext();
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productCreateTarget, setProductCreateTarget] = useState<"final" | "ingredient">("final");
  const [calculatorAmount, setCalculatorAmount] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Recipe form
  const [fIngredientId, setFIngredientId] = useState("");
  const [fBatchQuantity, setFBatchQuantity] = useState("");
  const [fIngredientBatchQuantity, setFIngredientBatchQuantity] = useState("");

  // Product form
  const [pName, setPName] = useState("");
  const [pUnit, setPUnit] = useState<ProductUnit>(ProductUnit.UNIT);
  const [pStock, setPStock] = useState("");
  const [pCostValue, setPCostValue] = useState("");
  const [pPriceMayorista, setPPriceMayorista] = useState("");
  const [pPriceMinorista, setPPriceMinorista] = useState("");
  const [pPriceFabrica, setPPriceFabrica] = useState("");

  const fetchProducts = useCallback(async () => {
    const bId = selectedLineId ?? undefined;
    const limit = 100;
    const all: Product[] = [];
    let page = 1;
    let res = await apiClient.getProducts(page, limit, false, undefined, undefined, bId);
    all.push(...res.data);
    while (res.meta.totalPages > page) {
      page += 1;
      res = await apiClient.getProducts(page, limit, false, undefined, undefined, bId);
      all.push(...res.data);
    }
    setProducts(all);
  }, [selectedLineId]);

  const fetchRecipes = useCallback(async () => {
    try {
      if (!selectedProductId) { setRecipes([]); setLoadError(null); return; }
      const limit = 100;
      setLoading(true);
      setLoadError(null);
      const all: RecipeItem[] = [];
      let page = 1;
      while (true) {
        const response = await apiClient.getRecipeItems(page, limit, selectedProductId);
        all.push(...response.data);
        if (response.meta.totalPages <= page) break;
        page += 1;
      }
      setRecipes(all);
    } catch (error) {
      const msg = getErrorMessage(error, "Error al cargar recetas");
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => { void fetchRecipes(); }, [fetchRecipes]);
  useEffect(() => { setCalculatorAmount(""); }, [selectedProductId]);
  useEffect(() => {
    fetchProducts().catch((e) => {
      console.error(e);
      toast.error("Error al cargar productos para los selectores");
    });
  }, [fetchProducts]);

  const ingredientOptions = useMemo(() => {
    if (!selectedProductId) return [];
    return products.filter((p) => p.id !== selectedProductId);
  }, [products, selectedProductId]);

  const productOptions = useMemo(() => products, [products]);
  const selectedProduct = useMemo(
    () => (selectedProductId ? products.find((p) => p.id === selectedProductId) : undefined),
    [products, selectedProductId],
  );
  const selectedIngredient = useMemo(
    () => (fIngredientId ? products.find((p) => p.id === fIngredientId) : undefined),
    [products, fIngredientId],
  );

  const handleCreate = () => {
    if (!selectedProductId) { toast.error("Elegí un producto final antes de agregar ingredientes"); return; }
    setEditingId(null);
    setFIngredientId("");
    setFBatchQuantity("");
    setFIngredientBatchQuantity("");
    setModalOpen(true);
  };

  const openCreateProductModal = (target: "final" | "ingredient") => {
    setProductCreateTarget(target);
    setPName(""); setPUnit(ProductUnit.UNIT); setPStock(""); setPCostValue("");
    setPPriceMayorista(""); setPPriceMinorista(""); setPPriceFabrica("");
    setProductModalOpen(true);
  };

  const handleEdit = (record: RecipeItem) => {
    setEditingId(record.id);
    setFIngredientId(record.ingredientId);
    setFBatchQuantity("1");
    setFIngredientBatchQuantity(String(record.quantity));
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteRecipeItem(id);
      toast.success("Ítem de receta eliminado");
      setDeleteId(null);
      void fetchRecipes();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar"));
      setDeleteId(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (!selectedProductId) { toast.error("Seleccioná un producto final"); return; }
      if (fIngredientId === selectedProductId) { toast.error("El producto elaborado y el ingrediente no pueden ser el mismo"); return; }
      const produced = Number(fBatchQuantity);
      const used = Number(fIngredientBatchQuantity);
      if (!Number.isFinite(produced) || produced <= 0) { toast.error("La cantidad elaborada debe ser mayor que 0"); return; }
      if (!Number.isFinite(used) || used <= 0) { toast.error("La cantidad del ingrediente debe ser mayor que 0"); return; }
      const normalizedQuantity = used / produced;
      if (!normalizedQuantity || normalizedQuantity <= 0) { toast.error("La cantidad es inválida"); return; }
      const data: CreateRecipeItemRequest = { productId: selectedProductId, ingredientId: fIngredientId, quantity: normalizedQuantity };
      if (editingId) {
        const patch: UpdateRecipeItemRequest = { quantity: normalizedQuantity };
        await apiClient.updateRecipeItem(editingId, patch);
        toast.success("Ítem de receta actualizado");
      } else {
        await apiClient.createRecipeItem(data);
        toast.success("Ítem de receta creado");
      }
      setModalOpen(false);
      void fetchRecipes();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar ítem de receta"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProductSubmit = async () => {
    setSubmitting(true);
    try {
      if (!pName.trim()) { toast.error("El nombre es requerido"); return; }
      const costValue = Number(pCostValue);
      if (!Number.isFinite(costValue)) { toast.error("El costo es requerido"); return; }
      const productData: CreateProductRequest = {
        name: pName.trim(),
        unit: pUnit,
        stock: pStock !== "" ? Number(pStock) : 0,
        businessLineId: selectedLineId ?? "",
      };
      const created = await apiClient.createProduct(productData);
      const costData: CreateCostRequest = { productId: created.id, value: costValue };
      await apiClient.createCost(costData);
      const priceFields: { val: string; description: "mayorista" | "minorista" | "fabrica" }[] = [
        { val: pPriceMayorista, description: "mayorista" },
        { val: pPriceMinorista, description: "minorista" },
        { val: pPriceFabrica, description: "fabrica" },
      ];
      for (const pf of priceFields) {
        const raw = Number(pf.val);
        if (!pf.val || !Number.isFinite(raw)) continue;
        const priceData: CreatePriceRequest = { productId: created.id, value: raw, description: pf.description };
        await apiClient.createPrice(priceData);
      }
      await fetchProducts();
      if (productCreateTarget === "ingredient") {
        setFIngredientId(created.id);
      } else {
        setSelectedProductId(created.id);
      }
      setProductModalOpen(false);
      toast.success("Producto creado y listo para usar en recetas");
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear producto"));
    } finally {
      setSubmitting(false);
    }
  };

  const calcAmount = Number(calculatorAmount) || 0;
  const calculatorRows = useMemo(() => {
    if (!calcAmount || !Number.isFinite(calcAmount) || calcAmount <= 0 || recipes.length === 0) return [];
    return recipes.map((r) => {
      const ing = r.ingredient;
      const unit = ing?.unit ?? ProductUnit.UNIT;
      return { key: r.id, name: ing?.name ?? "—", amount: r.quantity * calcAmount, unitLabel: UNIT_SHORT_LABEL[unit] };
    });
  }, [recipes, calcAmount]);

  const ratioText = useMemo(() => {
    const produced = Number(fBatchQuantity);
    const used = Number(fIngredientBatchQuantity);
    if (produced > 0 && used > 0 && selectedProduct && selectedIngredient) {
      const ratio = used / produced;
      const perKg = ingredientAmountPerKgOfFinal(ratio, selectedProduct.unit ?? ProductUnit.UNIT);
      const ingU = UNIT_SHORT_LABEL[selectedIngredient.unit ?? ProductUnit.UNIT];
      const nameIng = selectedIngredient.name ?? "ingrediente";
      const nameFin = selectedProduct.name ?? "final";
      if (perKg != null) return `Por cada 1 kg de «${nameFin}» se usan ${formatRecipeAmount(perKg)} ${ingU} de «${nameIng}».`;
      return `Por cada 1 ${UNIT_SHORT_LABEL[selectedProduct.unit ?? ProductUnit.UNIT]} de «${nameFin}» se usan ${formatRecipeAmount(ratio)} ${ingU} de «${nameIng}».`;
    }
    return "Completá ambos números para ver la proporción.";
  }, [fBatchQuantity, fIngredientBatchQuantity, selectedProduct, selectedIngredient]);

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Recetas</h1>
        <button className="ha-btn ha-btn--primary" onClick={() => openCreateProductModal("final")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Nuevo producto
        </button>
      </div>

      {loadError && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)" }}>
          <div style={{ color: "#f87171", fontWeight: 500, fontSize: 13 }}>No se pudieron cargar los ítems de receta</div>
          <div style={{ color: "var(--ha-text-3)", fontSize: 12 }}>{loadError}</div>
        </div>
      )}

      <div style={{ marginBottom: 16, background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ color: "var(--ha-text-3)", display: "block", marginBottom: 8, fontSize: 13 }}>Producto final (receta)</label>
            <select
              className="ha-input"
              value={selectedProductId ?? ""}
              onChange={(e) => setSelectedProductId(e.target.value || null)}
            >
              <option value="">Elegí el producto que querés fabricar</option>
              {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button
            className="ha-btn ha-btn--primary"
            onClick={handleCreate}
            disabled={!selectedProductId}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <Plus size={14} /> Agregar ingrediente
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <ScreenInfoPanel title="Cómo se lee la tabla de receta">
            <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
              Si el producto final está en <strong>kg</strong> o <strong>gr</strong>, la tabla muestra cuánto insumo
              entra por <strong>cada 1 kg de final</strong>. Si no, se muestra por la unidad del final.
            </span>
          </ScreenInfoPanel>
        </div>
      </div>

      {!selectedProductId ? (
        <div className="ha-empty" style={{ marginTop: 64 }}>
          <p className="ha-empty__t">Elegí un producto final para ver su receta</p>
        </div>
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : recipes.length > 0 ? (
        <>
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Proporción</th>
                  <th>Alta</th>
                  <th style={{ width: 120 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((record) => {
                  const ing = record.ingredient;
                  const ingU = UNIT_SHORT_LABEL[ing?.unit ?? ProductUnit.UNIT];
                  const q = record.quantity;
                  const final = selectedProduct;
                  const perKg = final ? ingredientAmountPerKgOfFinal(q, final.unit ?? ProductUnit.UNIT) : null;
                  const propText = perKg != null
                    ? `${formatRecipeAmount(perKg)} ${ingU} / kg de final`
                    : `${formatRecipeAmount(q)} ${ingU} por 1 ${UNIT_SHORT_LABEL[final?.unit ?? ProductUnit.UNIT]} de final`;
                  return (
                    <tr key={record.id}>
                      <td>{ing?.name ? `${ing.name} (${ingU})` : "—"}</td>
                      <td className="ha-mono">{propText}</td>
                      <td style={{ color: "var(--ha-text-3)", fontSize: 12 }}>
                        {record.createdAt ? new Date(record.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => handleEdit(record)} style={{ display: "inline-flex", alignItems: "center" }}><Edit size={12} /></button>
                          <button onClick={() => setDeleteId(record.id)} style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 6, color: "var(--ha-red)", cursor: "pointer" }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Calculator */}
          <div style={{ marginTop: 20, background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ha-border)" }}>
              <span style={{ color: "var(--ha-text)", fontWeight: 500 }}>Calculadora de ingredientes</span>
            </div>
            <div style={{ padding: 16 }}>
              <ScreenInfoPanel title="Cómo usar la calculadora de ingredientes" style={{ marginBottom: 16 }}>
                <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                  Indicá <strong>cuánto vas a elaborar del producto final</strong> (en{" "}
                  {UNIT_SHORT_LABEL[selectedProduct?.unit ?? ProductUnit.UNIT]}). El listado es solo orientativo.
                </span>
              </ScreenInfoPanel>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <span style={{ color: "var(--ha-text)" }}>Quiero elaborar</span>
                <input
                  type="number"
                  className="ha-input"
                  min={0.0001}
                  step={0.01}
                  placeholder="Ej. 2,5"
                  value={calculatorAmount}
                  onChange={(e) => setCalculatorAmount(e.target.value)}
                  style={{ width: 120 }}
                />
                <span style={{ color: "var(--ha-text-3)" }}>
                  {UNIT_SHORT_LABEL[selectedProduct?.unit ?? ProductUnit.UNIT]} de «{selectedProduct?.name ?? "final"}»
                </span>
              </div>
              {calculatorRows.length > 0 ? (
                <div className="ha-table-wrap">
                  <table className="ha-table">
                    <thead>
                      <tr>
                        <th>Ingrediente</th>
                        <th>Cantidad a usar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatorRows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.name}</td>
                          <td className="ha-mono">{formatRecipeAmount(row.amount)} {row.unitLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ha-empty">
                  <p className="ha-empty__s">Ingresá un número arriba para ver cuánto necesitás de cada ingrediente</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="ha-empty">
          <p className="ha-empty__t">{loadError ? "Reintentá cuando la API esté disponible" : "No hay ingredientes para esta receta"}</p>
        </div>
      )}

      {/* Recipe ingredient modal */}
      {modalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">{editingId ? "Editar ingrediente" : "Agregar ingrediente"}</span>
              <button className="ha-iconbtn" onClick={() => setModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <ScreenInfoPanel title="Cómo cargar las cantidades de la tanda" style={{ marginBottom: 16 }}>
                <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                  Receta de <strong>{selectedProduct?.name ?? "…"}</strong>. Para cada ingrediente cargás dos
                  cantidades de la misma tanda.
                </span>
              </ScreenInfoPanel>
              <div className="ha-field" style={{ marginBottom: 8 }}>
                <label className="ha-label">Ingrediente <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <select
                  className="ha-input"
                  value={fIngredientId}
                  onChange={(e) => setFIngredientId(e.target.value)}
                  disabled={!!editingId}
                >
                  <option value="">Elegí un ingrediente</option>
                  {ingredientOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {!editingId && (
                <button type="button" onClick={() => openCreateProductModal("ingredient")} style={{ background: "none", border: "none", color: "var(--ha-amber)", cursor: "pointer", fontSize: 13, padding: "0 0 12px 0" }}>
                  + Crear producto nuevo sin salir de recetas
                </button>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ha-field">
                  <label className="ha-label">
                    Cuánto hacés de «{selectedProduct?.name ?? "final"}»
                    <span style={{ display: "block", color: "var(--ha-text-4)", fontSize: 11, fontWeight: 400 }}>
                      ({UNIT_SHORT_LABEL[selectedProduct?.unit ?? ProductUnit.UNIT]}) en la tanda
                    </span>
                  </label>
                  <input type="number" className="ha-input" min={0.0001} step={0.01} placeholder="Ej: 1" value={fBatchQuantity} onChange={(e) => setFBatchQuantity(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">
                    Cuánto de «{selectedIngredient?.name ?? "el ingrediente"}»
                    <span style={{ display: "block", color: "var(--ha-text-4)", fontSize: 11, fontWeight: 400 }}>
                      ({UNIT_SHORT_LABEL[selectedIngredient?.unit ?? ProductUnit.UNIT]}) en esa tanda
                    </span>
                  </label>
                  <input type="number" className="ha-input" min={0.0001} step={0.01} placeholder="Ej: 0.7" value={fIngredientBatchQuantity} onChange={(e) => setFIngredientBatchQuantity(e.target.value)} />
                </div>
              </div>
              <p style={{ color: "var(--ha-text-3)", marginTop: 14, fontSize: 13, lineHeight: 1.5 }}>{ratioText}</p>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* New product modal */}
      {productModalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setProductModalOpen(false)} style={{ zIndex: 130 }}>
          <div className="ha-modal" style={{ maxWidth: 560, zIndex: 131 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Nuevo producto</span>
              <button className="ha-iconbtn" onClick={() => setProductModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Nombre <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input className="ha-input" placeholder="Nombre del producto" value={pName} onChange={(e) => setPName(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Unidad de medida</label>
                <select className="ha-input" value={pUnit} onChange={(e) => setPUnit(e.target.value as ProductUnit)}>
                  {PRODUCT_UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Stock inicial (opcional)</label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 10 o 3,5" value={pStock} onChange={(e) => setPStock(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Costo (obligatorio) <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 1200" value={pCostValue} onChange={(e) => setPCostValue(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="ha-field">
                  <label className="ha-label">Precio mayorista (opcional)</label>
                  <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 1500" value={pPriceMayorista} onChange={(e) => setPPriceMayorista(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Precio minorista (opcional)</label>
                  <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 1800" value={pPriceMinorista} onChange={(e) => setPPriceMinorista(e.target.value)} />
                </div>
              </div>
              <div className="ha-field">
                <label className="ha-label">Precio fábrica (opcional)</label>
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 1300" value={pPriceFabrica} onChange={(e) => setPPriceFabrica(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setProductModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleCreateProductSubmit()} disabled={submitting}>{submitting ? "Creando…" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar ítem de receta?</h3>
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
