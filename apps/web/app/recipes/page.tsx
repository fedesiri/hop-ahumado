"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { PRICE_TYPE_LABELS, type PriceType } from "@/lib/order-calculator/price-types";
import { toast } from "@/lib/toast";
import {
  ProductUnit,
  RecipeType,
  type CreateCostRequest,
  type CreatePriceRequest,
  type CreateProductRequest,
  type CreateRecipeCostProfileRequest,
  type CreateRecipeItemRequest,
  type Product,
  type RecipeCosting,
  type RecipeCostProfile,
  type RecipeItem,
  type RecipePricing,
  type UpdateRecipeCostProfileRequest,
} from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Spinner } from "@/components/spinner";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const RECIPE_TYPE_LABELS: Record<RecipeType, string> = {
  [RecipeType.PREPARACION_BASE]: "Preparación base",
  [RecipeType.PRODUCTO_FINAL]: "Producto final",
};

function pctToInput(v: number | null | undefined): string {
  return v == null ? "" : String(Math.round(v * 1000) / 10);
}

function inputToPct(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n / 100 : null;
}

const PRODUCT_UNIT_OPTIONS: { label: string; value: ProductUnit }[] = [
  { label: "Unidad", value: ProductUnit.UNIT },
  { label: "Kg", value: ProductUnit.KG },
  { label: "Gr", value: ProductUnit.G },
  { label: "Litro", value: ProductUnit.L },
  { label: "Ml", value: ProductUnit.ML },
];

const UNIT_SHORT: Record<ProductUnit, string> = {
  [ProductUnit.UNIT]: "un",
  [ProductUnit.KG]: "KG",
  [ProductUnit.G]: "G",
  [ProductUnit.L]: "L",
  [ProductUnit.ML]: "ML",
};

const BATCH_REF = 100;
const QUICK_VALS = [10, 50, 100, 200];

function fmtAmt(n: number): string {
  return (Math.round(n * 10000) / 10000).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [mobTab, setMobTab] = useState<"ing" | "calc">("ing");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [calculatorAmount, setCalculatorAmount] = useState("");

  // Costeo de receta (perfil + motor de cálculo)
  const [profile, setProfile] = useState<RecipeCostProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [costing, setCosting] = useState<RecipeCosting | null>(null);
  const [pricing, setPricing] = useState<RecipePricing | null>(null);
  const [profileForm, setProfileForm] = useState<UpdateRecipeCostProfileRequest>({});
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [allProfiles, setAllProfiles] = useState<RecipeCostProfile[]>([]);

  // Add form
  const [fIngredientId, setFIngredientId] = useState("");
  const [fQty, setFQty] = useState("");
  const [fBatch, setFBatch] = useState(String(BATCH_REF));

  // Product create modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productCreateTarget, setProductCreateTarget] = useState<"final" | "ingredient">("final");
  const [pName, setPName] = useState("");
  const [pUnit, setPUnit] = useState<ProductUnit>(ProductUnit.UNIT);
  const [pStock, setPStock] = useState("");
  const [pCostValue, setPCostValue] = useState("");
  const [pPriceMayorista, setPPriceMayorista] = useState("");
  const [pPriceMinorista, setPPriceMinorista] = useState("");
  const [pPriceFabrica, setPPriceFabrica] = useState("");
  const [pPriceCatering, setPPriceCatering] = useState("");

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
    if (!selectedProductId) { setRecipes([]); return; }
    try {
      setLoading(true);
      const all: RecipeItem[] = [];
      let page = 1;
      while (true) {
        const res = await apiClient.getRecipeItems(page, 100, selectedProductId);
        all.push(...res.data);
        if (res.meta.totalPages <= page) break;
        page += 1;
      }
      setRecipes(all);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar recetas"));
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => { void fetchRecipes(); }, [fetchRecipes]);
  useEffect(() => { setCalculatorAmount(""); setAddOpen(false); }, [selectedProductId]);
  useEffect(() => {
    fetchProducts().catch(() => toast.error("Error al cargar productos"));
  }, [fetchProducts]);

  const fetchCostingAndPricing = useCallback(async (productId: string) => {
    try {
      const [c, p] = await Promise.all([apiClient.getRecipeCosting(productId), apiClient.getRecipePricing(productId)]);
      setCosting(c);
      setPricing(p);
    } catch {
      setCosting(null);
      setPricing(null);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!selectedProductId) {
      setProfile(null); setCosting(null); setPricing(null); setProfileForm({});
      return;
    }
    setProfileLoading(true);
    try {
      const p = await apiClient.getRecipeCostProfile(selectedProductId);
      setProfile(p);
      setProfileForm({
        recipeType: p.recipeType,
        saleUnitLabel: p.saleUnitLabel,
        unitsPerPack: p.unitsPerPack ?? undefined,
        packName: p.packName ?? undefined,
        mainIngredientId: p.mainIngredientId ?? undefined,
        mainIngredientQty: p.mainIngredientQty ?? undefined,
        cookingLossPct: p.cookingLossPct,
        kgPerSaleUnit: p.kgPerSaleUnit ?? undefined,
        yieldManual: p.yieldManual ?? undefined,
        wastePct: p.wastePct,
        laborHoursPerBatch: p.laborHoursPerBatch,
        marginRetailPct: p.marginRetailPct,
        marginWholesalePct: p.marginWholesalePct,
        marginCateringPct: p.marginCateringPct,
        active: p.active,
        notes: p.notes ?? undefined,
      });
      void fetchCostingAndPricing(selectedProductId);
    } catch {
      setProfile(null);
      setCosting(null);
      setPricing(null);
      setProfileForm({ recipeType: RecipeType.PRODUCTO_FINAL, saleUnitLabel: "unidad", cookingLossPct: 0, wastePct: 0, laborHoursPerBatch: 0 });
    } finally {
      setProfileLoading(false);
    }
  }, [selectedProductId, fetchCostingAndPricing]);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const fetchAllProfiles = useCallback(async () => {
    try {
      const res = await apiClient.getRecipeCostProfiles(1, 100, selectedLineId ?? undefined);
      setAllProfiles(res.data);
    } catch {
      // silent
    }
  }, [selectedLineId]);

  useEffect(() => { void fetchAllProfiles(); }, [fetchAllProfiles]);

  const ingredientOptions = useMemo(
    () => (selectedProductId ? products.filter((p) => p.id !== selectedProductId) : []),
    [products, selectedProductId],
  );
  const selectedProduct = useMemo(
    () => (selectedProductId ? products.find((p) => p.id === selectedProductId) : undefined),
    [products, selectedProductId],
  );

  const handleAddIngredient = async () => {
    if (!selectedProductId) return;
    if (!fIngredientId) { toast.error("Elegí un ingrediente"); return; }
    const qty = Number(fQty);
    const batch = Number(fBatch) || BATCH_REF;
    if (!qty || qty <= 0) { toast.error("Ingresá una cantidad mayor a 0"); return; }
    const normalized = qty / batch;
    setSubmitting(true);
    try {
      const data: CreateRecipeItemRequest = { productId: selectedProductId, ingredientId: fIngredientId, quantity: normalized };
      await apiClient.createRecipeItem(data);
      toast.success("Ingrediente agregado");
      setAddOpen(false);
      setFIngredientId(""); setFQty(""); setFBatch(String(BATCH_REF));
      void fetchRecipes();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al agregar ingrediente"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteRecipeItem(id);
      toast.success("Ingrediente eliminado");
      setDeleteId(null);
      void fetchRecipes();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar"));
      setDeleteId(null);
    }
  };

  const handleCreateProductSubmit = async () => {
    setSubmitting(true);
    try {
      if (!pName.trim()) { toast.error("El nombre es requerido"); return; }
      const costValue = Number(pCostValue);
      if (!Number.isFinite(costValue)) { toast.error("El costo es requerido"); return; }
      const productData: CreateProductRequest = {
        name: pName.trim(), unit: pUnit,
        stock: pStock !== "" ? Number(pStock) : 0,
        businessLineId: selectedLineId ?? "",
      };
      const created = await apiClient.createProduct(productData);
      await apiClient.createCost({ productId: created.id, value: costValue } satisfies CreateCostRequest);
      const priceFields: { val: string; description: PriceType }[] = [
        { val: pPriceMayorista, description: "mayorista" },
        { val: pPriceMinorista, description: "minorista" },
        { val: pPriceFabrica, description: "fabrica" },
        { val: pPriceCatering, description: "catering" },
      ];
      for (const pf of priceFields) {
        const raw = Number(pf.val);
        if (!pf.val || !Number.isFinite(raw)) continue;
        await apiClient.createPrice({ productId: created.id, value: raw, description: pf.description } satisfies CreatePriceRequest);
      }
      await fetchProducts();
      if (productCreateTarget === "ingredient") setFIngredientId(created.id);
      else setSelectedProductId(created.id);
      setProductModalOpen(false);
      toast.success("Producto creado");
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear producto"));
    } finally {
      setSubmitting(false);
    }
  };

  const saveProfile = async () => {
    if (!selectedProductId) return;
    if (!profileForm.saleUnitLabel?.trim()) { toast.error("La unidad de venta es obligatoria"); return; }
    setProfileSaving(true);
    try {
      if (profile) {
        await apiClient.updateRecipeCostProfile(selectedProductId, profileForm);
      } else {
        const data: CreateRecipeCostProfileRequest = {
          ...profileForm,
          productId: selectedProductId,
          recipeType: profileForm.recipeType ?? RecipeType.PRODUCTO_FINAL,
          saleUnitLabel: profileForm.saleUnitLabel,
        };
        await apiClient.createRecipeCostProfile(data);
      }
      toast.success("Perfil de receta guardado");
      await fetchProfile();
      void fetchAllProfiles();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar el perfil de receta"));
    } finally {
      setProfileSaving(false);
    }
  };

  const saveOverride = async (channel: PriceType) => {
    if (!selectedProductId) return;
    const raw = overrideDrafts[channel];
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0) { toast.error("Ingresá un precio válido"); return; }
    try {
      await apiClient.createPrice({ productId: selectedProductId, value, description: channel });
      toast.success("Precio actualizado");
      setOverrideDrafts((prev) => ({ ...prev, [channel]: "" }));
      void fetchCostingAndPricing(selectedProductId);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar el precio"));
    }
  };

  const calcAmount = Number(calculatorAmount) || 0;
  const finalUnit = selectedProduct ? UNIT_SHORT[selectedProduct.unit ?? ProductUnit.L] : "L";

  const calculatorRows = useMemo(() => {
    if (!calcAmount || !Number.isFinite(calcAmount) || calcAmount <= 0 || recipes.length === 0) return [];
    return recipes.map((r) => {
      const ing = r.ingredient;
      const unit = UNIT_SHORT[ing?.unit ?? ProductUnit.KG];
      const amount = r.quantity * calcAmount;
      const gramsDetail = amount < 1 && amount > 0 ? ` (= ${Math.round(amount * 1000)} g)` : null;
      return { key: r.id, name: ing?.name ?? "—", amount, unit, gramsDetail };
    });
  }, [recipes, calcAmount]);

  const openAddForm = () => {
    setFIngredientId(""); setFQty(""); setFBatch(String(BATCH_REF));
    setAddOpen(true);
  };

  const openCreateProductModal = (target: "final" | "ingredient") => {
    setProductCreateTarget(target);
    setPName(""); setPUnit(ProductUnit.UNIT); setPStock(""); setPCostValue("");
    setPPriceMayorista(""); setPPriceMinorista(""); setPPriceFabrica(""); setPPriceCatering("");
    setProductModalOpen(true);
  };

  return (
    <div>
      <h1 className="pc-pagetitle">Recetas</h1>

      {/* Product selector card */}
      <div className="rc-selbar">
        <div className="rc-sellabel">Producto final</div>
        <select
          className="rc-fselect"
          value={selectedProductId ?? ""}
          onChange={(e) => setSelectedProductId(e.target.value || null)}
        >
          <option value="">Seleccionar un producto…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedProduct && (
          <div className="rc-selsub">
            Receta de {selectedProduct.name} · {recipes.length} ingrediente{recipes.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {!selectedProductId ? (
        <EmptyState title="Seleccioná un producto para ver su receta" style={{ marginTop: 48 }} />
      ) : loading ? (
        <Spinner />
      ) : (
        <>
          {/* Mobile tabs */}
          <div className="rc-tabs">
            <button className={"rc-tab" + (mobTab === "ing" ? " on" : "")} onClick={() => setMobTab("ing")}>Ingredientes</button>
            <button className={"rc-tab" + (mobTab === "calc" ? " on" : "")} onClick={() => setMobTab("calc")}>Calculadora</button>
          </div>

          <div className="rc-cols">
            {/* Left: ingredients */}
            <div className={"rc-col--l rc-card" + (mobTab !== "ing" ? " mob-hidden" : "")}>
              <div className="rc-card__head">
                <span className="rc-card__title">
                  Ingredientes · {selectedProduct?.name ?? ""}
                </span>
                <button className="rc-addbtn" onClick={openAddForm}>
                  <Plus size={14} /> Agregar ingrediente
                </button>
              </div>

              {recipes.length === 0 && !addOpen ? (
                <EmptyState title="Sin ingredientes" subtitle="Agregá el primer ingrediente con el botón de arriba" style={{ padding: "32px 0" }} />
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="ps-tablewrap">
                    <table className="rc-table">
                      <thead>
                        <tr>
                          <th>Ingrediente</th>
                          <th style={{ textAlign: "right" }}>Cant./Batch</th>
                          <th>Unidad</th>
                          <th>Proporción</th>
                          <th style={{ width: 48 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {recipes.map((r) => {
                          const ing = r.ingredient;
                          const unit = UNIT_SHORT[ing?.unit ?? ProductUnit.KG];
                          const cantPerBatch = r.quantity * BATCH_REF;
                          return (
                            <tr key={r.id}>
                              <td>{ing?.name ?? "—"}</td>
                              <td style={{ textAlign: "right" }}>
                                <span className="rc-ing-amt">{fmtAmt(cantPerBatch)}</span>
                              </td>
                              <td><span className="rc-ing-unit">{unit}</span></td>
                              <td>
                                <span className="rc-ing-prop">
                                  {fmtAmt(cantPerBatch)} / {BATCH_REF} {finalUnit}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="rc-xbtn"
                                  onClick={() => setDeleteId(r.id)}
                                  aria-label="Eliminar ingrediente"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <div className="rc-cardlist ps-cardlist" style={{ padding: 0 }}>
                    {recipes.map((r) => {
                      const ing = r.ingredient;
                      const unit = UNIT_SHORT[ing?.unit ?? ProductUnit.KG];
                      const cantPerBatch = r.quantity * BATCH_REF;
                      return (
                        <div key={r.id} className="rc-ingcard">
                          <div>
                            <div className="rc-ingcard__n">{ing?.name ?? "—"}</div>
                            <div style={{ fontSize: 12, color: "var(--ha-text-3)", marginTop: 2 }}>
                              {fmtAmt(cantPerBatch)} / {BATCH_REF} {finalUnit}
                            </div>
                          </div>
                          <div className="rc-ingcard__r">
                            <span className="rc-ingcard__amt">{fmtAmt(cantPerBatch)} {unit}</span>
                            <button
                              className="rc-ingcard__x"
                              onClick={() => setDeleteId(r.id)}
                              aria-label="Eliminar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Add ingredient inline form */}
              {addOpen && (
                <div className="rc-addform">
                  <div className="rc-addrow">
                    <div className="rc-ff" style={{ flex: 2, minWidth: 140 }}>
                      <label>Ingrediente</label>
                      <select className="rc-fsel2" style={{ width: "100%" }} value={fIngredientId} onChange={(e) => setFIngredientId(e.target.value)}>
                        <option value="">Elegí un ingrediente</option>
                        {ingredientOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="rc-ff" style={{ width: 90 }}>
                      <label>Cant. ingr.</label>
                      <input type="number" className="rc-finput" style={{ width: "100%" }} min={0.0001} step={0.001} placeholder="Ej: 22" value={fQty} onChange={(e) => setFQty(e.target.value)} />
                    </div>
                    <div className="rc-ff" style={{ width: 90 }}>
                      <label>Cant. batch</label>
                      <input type="number" className="rc-finput" style={{ width: "100%" }} min={0.0001} step={1} value={fBatch} onChange={(e) => setFBatch(e.target.value)} />
                    </div>
                    <button
                      className="pc-btn pc-btn--primary"
                      style={{ height: 40, alignSelf: "flex-end", flexShrink: 0 }}
                      onClick={() => void handleAddIngredient()}
                      disabled={submitting}
                    >
                      {submitting ? "Agregando…" : "Agregar"}
                    </button>
                    <button
                      className="pc-btn pc-btn--ghost"
                      style={{ height: 40, alignSelf: "flex-end", flexShrink: 0 }}
                      onClick={() => setAddOpen(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                  <p className="rc-addnote">
                    La proporción se calcula como: ingrediente ÷ batch.{" "}
                    <a onClick={() => openCreateProductModal("ingredient")}>+ Crear producto nuevo</a>
                  </p>
                </div>
              )}

              <div className="rc-note">
                Batch de referencia: <b>{BATCH_REF} {finalUnit}</b>
              </div>
            </div>

            {/* Right: calculator */}
            <div className={"rc-col--r rc-card" + (mobTab !== "calc" ? " mob-hidden" : "")}>
              <div className="rc-calc">
                <div className="rc-calc__title">Calculadora</div>
                <div className="rc-calc__sub">Ingresá la cantidad a producir</div>

                <label className="rc-calc__label">
                  Cantidad a producir ({finalUnit})
                </label>
                <input
                  type="number"
                  className="rc-calc__input"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={calculatorAmount}
                  onChange={(e) => setCalculatorAmount(e.target.value)}
                />
                <div className="rc-quick">
                  {QUICK_VALS.map((v) => (
                    <button
                      key={v}
                      className={"rc-chip" + (calculatorAmount === String(v) ? " on" : "")}
                      onClick={() => setCalculatorAmount(String(v))}
                    >
                      {v} {finalUnit}
                    </button>
                  ))}
                </div>

                {calculatorRows.length > 0 && (
                  <>
                    <div className="rc-sep" />
                    <div className="rc-needs">Necesitás:</div>
                    {calculatorRows.map((row) => (
                      <div key={row.key} className="rc-resrow">
                        <span className="rc-resrow__n">{row.name}</span>
                        <span className="rc-resrow__v">
                          {fmtAmt(row.amount)} {row.unit}
                          {row.gramsDetail && <small>{row.gramsDetail}</small>}
                        </span>
                      </div>
                    ))}
                    <div className="rc-infobox">
                      Basado en un batch de referencia de {BATCH_REF} {finalUnit}.
                    </div>
                  </>
                )}

                {recipes.length === 0 && calcAmount > 0 && (
                  <div className="ha-empty" style={{ padding: "24px 0" }}>
                    <p className="ha-empty__s">Agregá ingredientes a la receta primero</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Costeo de receta */}
          <div className="rc-card" style={{ marginTop: 16, padding: 20 }}>
            <div className="rc-card__head">
              <span className="rc-card__title">Costeo de receta · {selectedProduct?.name ?? ""}</span>
            </div>

            {profileLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="ha-formgrid" style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="ha-field">
                      <label className="ha-label">Tipo</label>
                      <select
                        className="ha-input ha-select"
                        value={profileForm.recipeType ?? RecipeType.PRODUCTO_FINAL}
                        onChange={(e) => setProfileForm((p) => ({ ...p, recipeType: e.target.value as RecipeType }))}
                      >
                        {Object.values(RecipeType).map((t) => <option key={t} value={t}>{RECIPE_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Unidad de venta</label>
                      <input className="ha-input" placeholder="kg, unidad, porción 300 g…" value={profileForm.saleUnitLabel ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, saleUnitLabel: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="ha-field">
                      <label className="ha-label">Unidades por pack</label>
                      <input type="number" className="ha-input" min={0} step={1} value={profileForm.unitsPerPack ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, unitsPerPack: e.target.value ? Number(e.target.value) : undefined }))} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Nombre del pack</label>
                      <input className="ha-input" placeholder="docena, combo, bandeja…" value={profileForm.packName ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, packName: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="ha-field">
                      <label className="ha-label">Insumo principal (para rinde)</label>
                      <select className="ha-input ha-select" value={profileForm.mainIngredientId ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, mainIngredientId: e.target.value || undefined }))}>
                        <option value="">Sin insumo principal</option>
                        {ingredientOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Kg insumo principal</label>
                      <input type="number" className="ha-input" min={0} step={0.01} value={profileForm.mainIngredientQty ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, mainIngredientQty: e.target.value ? Number(e.target.value) : undefined }))} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div className="ha-field">
                      <label className="ha-label">Merma cocción %</label>
                      <input type="number" className="ha-input" min={0} max={100} step={0.1} value={pctToInput(profileForm.cookingLossPct)} onChange={(e) => setProfileForm((p) => ({ ...p, cookingLossPct: inputToPct(e.target.value) ?? 0 }))} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Kg por unidad de venta</label>
                      <input type="number" className="ha-input" min={0} step={0.001} value={profileForm.kgPerSaleUnit ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, kgPerSaleUnit: e.target.value ? Number(e.target.value) : undefined }))} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Rinde manual</label>
                      <input type="number" className="ha-input" min={0} step={0.01} value={profileForm.yieldManual ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, yieldManual: e.target.value ? Number(e.target.value) : undefined }))} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="ha-field">
                      <label className="ha-label">Desperdicio %</label>
                      <input type="number" className="ha-input" min={0} max={100} step={0.1} value={pctToInput(profileForm.wastePct)} onChange={(e) => setProfileForm((p) => ({ ...p, wastePct: inputToPct(e.target.value) ?? 0 }))} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Horas-hombre / tanda</label>
                      <input type="number" className="ha-input" min={0} step={0.1} value={profileForm.laborHoursPerBatch ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, laborHoursPerBatch: e.target.value ? Number(e.target.value) : 0 }))} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div className="ha-field">
                      <label className="ha-label">Margen minorista % (vacío = no se vende)</label>
                      <input type="number" className="ha-input" min={0} max={100} step={0.1} value={pctToInput(profileForm.marginRetailPct)} onChange={(e) => setProfileForm((p) => ({ ...p, marginRetailPct: inputToPct(e.target.value) }))} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Margen mayorista % (vacío = no se vende)</label>
                      <input type="number" className="ha-input" min={0} max={100} step={0.1} value={pctToInput(profileForm.marginWholesalePct)} onChange={(e) => setProfileForm((p) => ({ ...p, marginWholesalePct: inputToPct(e.target.value) }))} />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Margen catering % (vacío = no se vende)</label>
                      <input type="number" className="ha-input" min={0} max={100} step={0.1} value={pctToInput(profileForm.marginCateringPct)} onChange={(e) => setProfileForm((p) => ({ ...p, marginCateringPct: inputToPct(e.target.value) }))} />
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ha-text-2)" }}>
                    <input type="checkbox" checked={profileForm.active ?? true} onChange={(e) => setProfileForm((p) => ({ ...p, active: e.target.checked }))} />
                    Activo
                  </label>

                  <div className="ha-field">
                    <label className="ha-label">Notas</label>
                    <textarea className="ha-textarea" rows={2} value={profileForm.notes ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button className="ha-btn ha-btn--primary" onClick={() => void saveProfile()} disabled={profileSaving}>
                    {profileSaving ? "Guardando…" : profile ? "Guardar cambios" : "Crear perfil de costeo"}
                  </button>
                </div>

                {costing && (
                  <>
                    <div className="rc-sep" style={{ margin: "16px 0" }} />
                    <div className="rc-card__title" style={{ marginBottom: 10 }}>Resultado del costeo</div>
                    {costing.alerts.length > 0 && (
                      <div className="ha-empty" style={{ padding: 12, marginBottom: 12, textAlign: "left", background: "var(--ha-red-soft)", borderRadius: 8 }}>
                        {costing.alerts.map((a, i) => <div key={i} style={{ color: "var(--ha-red)", fontSize: 13 }}>⚠️ {a}</div>)}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                      <div className="rc-resrow"><span className="rc-resrow__n">Materia prima</span><span className="rc-resrow__v">{formatCurrency(costing.materialCost)}</span></div>
                      <div className="rc-resrow"><span className="rc-resrow__n">Con desperdicio</span><span className="rc-resrow__v">{formatCurrency(costing.costWithWaste)}</span></div>
                      <div className="rc-resrow"><span className="rc-resrow__n">Mano de obra</span><span className="rc-resrow__v">{formatCurrency(costing.laborCost)}</span></div>
                      <div className="rc-resrow"><span className="rc-resrow__n">Operativo fijo</span><span className="rc-resrow__v">{formatCurrency(costing.overheadCost)}</span></div>
                      <div className="rc-resrow"><span className="rc-resrow__n">Rinde usado</span><span className="rc-resrow__v">{fmtAmt(costing.rindeUsado)}</span></div>
                      <div className="rc-resrow"><span className="rc-resrow__n"><b>Costo por unidad</b></span><span className="rc-resrow__v"><b>{formatCurrency(costing.costPerUnit)}</b></span></div>
                    </div>
                  </>
                )}

                {pricing && (
                  <>
                    <div className="rc-sep" style={{ margin: "16px 0" }} />
                    <div className="rc-card__title" style={{ marginBottom: 10 }}>Precios por canal</div>
                    <div className="ps-tablewrap">
                      <table className="rc-table">
                        <thead>
                          <tr>
                            <th>Canal</th>
                            <th>Margen</th>
                            <th>Comisión</th>
                            <th>Calculado</th>
                            <th>Override</th>
                            <th>Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pricing.channels.map((ch) => (
                            <tr key={ch.channel}>
                              <td>{PRICE_TYPE_LABELS[ch.channel]}</td>
                              <td>{ch.marginPct != null ? `${Math.round(ch.marginPct * 1000) / 10}%` : "no se vende"}</td>
                              <td>{Math.round(ch.commissionPct * 1000) / 10}%</td>
                              <td>{ch.calculatedPrice != null ? formatCurrency(ch.calculatedPrice) : "—"}</td>
                              <td>
                                {ch.marginPct == null ? (
                                  <span style={{ color: "var(--ha-text-3)", fontSize: 13 }}>no se vende</span>
                                ) : (
                                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <input
                                      type="number"
                                      className="rc-finput"
                                      style={{ width: 100 }}
                                      placeholder={ch.overridePrice != null ? String(ch.overridePrice) : "manual"}
                                      value={overrideDrafts[ch.channel] ?? ""}
                                      onChange={(e) => setOverrideDrafts((prev) => ({ ...prev, [ch.channel]: e.target.value }))}
                                    />
                                    <button className="pc-btn pc-btn--ghost pc-btn--sm" onClick={() => void saveOverride(ch.channel)}>OK</button>
                                  </div>
                                )}
                              </td>
                              <td><b>{ch.marginPct == null ? "no se vende" : ch.finalPrice != null ? formatCurrency(ch.finalPrice) : "—"}</b></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Rentabilidad (solo lectura) */}
      {allProfiles.length > 0 && (
        <div className="rc-card" style={{ marginTop: 16, padding: 20 }}>
          <div className="rc-card__head">
            <span className="rc-card__title">Rentabilidad</span>
          </div>
          <div className="ps-tablewrap" style={{ marginTop: 12 }}>
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Receta</th>
                  <th>Tipo</th>
                  <th>Costo/u</th>
                  <th>Margen min.</th>
                  <th>Margen may.</th>
                  <th>Margen cat.</th>
                  <th style={{ width: 48 }} />
                </tr>
              </thead>
              <tbody>
                {allProfiles.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.product?.name ?? "—"}</td>
                    <td>{RECIPE_TYPE_LABELS[p.recipeType]}</td>
                    <td>{p.costPerUnit != null ? formatCurrency(p.costPerUnit) : "—"}</td>
                    <td>{p.marginRetailPct != null ? `${Math.round(p.marginRetailPct * 1000) / 10}%` : "—"}</td>
                    <td>{p.marginWholesalePct != null ? `${Math.round(p.marginWholesalePct * 1000) / 10}%` : "—"}</td>
                    <td>{p.marginCateringPct != null ? `${Math.round(p.marginCateringPct * 1000) / 10}%` : "—"}</td>
                    <td>
                      <button className="pc-btn pc-btn--ghost pc-btn--sm" onClick={() => setSelectedProductId(p.productId)}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product create modal */}
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
                <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 10" value={pStock} onChange={(e) => setPStock(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 12 }}>
                <label className="ha-label">Costo <span style={{ color: "var(--ha-red)" }}>*</span></label>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ha-field">
                  <label className="ha-label">Precio fábrica (opcional)</label>
                  <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 1300" value={pPriceFabrica} onChange={(e) => setPPriceFabrica(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Precio catering (opcional)</label>
                  <input type="number" className="ha-input" min={0} step={0.01} placeholder="Ej: 1400" value={pPriceCatering} onChange={(e) => setPPriceCatering(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setProductModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleCreateProductSubmit()} disabled={submitting}>
                {submitting ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <ConfirmDialog
          title="¿Eliminar ingrediente?"
          description="Esta acción no se puede deshacer."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void handleDelete(deleteId)}
        />
      )}
    </div>
  );
}
