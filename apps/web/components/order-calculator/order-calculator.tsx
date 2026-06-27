"use client";

import { formatCurrency } from "@/lib/format-currency";
import {
  ORDER_PROMO_THRESHOLD_ARS,
  computeOrderTotalWithPromo,
  effectiveUnitPriceForOrderLine,
  getPromoThresholdCategoryNames,
  isPromoGiftComboName,
} from "@/lib/order-calculator/order-promo";
import {
  PRICE_TYPE_LABELS,
  PRICE_TYPES,
  getPriceForType,
  type PriceType,
} from "@/lib/order-calculator/price-types";
import { toast } from "@/lib/toast";
import type { Price, Product } from "@/lib/types";
import { ArrowRight, Copy, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductRow } from "./product-row";

const STORAGE_KEYS = {
  priceType: "order-calc-price-type",
  customerId: "order-calc-customer-id",
  quantities: "order-calc-quantities",
};

export interface OrderCalculatorProps {
  products: Product[];
  pricesByProductId: Record<string, Price[]>;
  customers: { id: string; name: string }[];
  onConfirmOrder?: (
    items: { productId: string; quantity: number; price: number }[],
    total: number,
    customerId?: string | null,
    priceListType?: PriceType,
  ) => void;
  initialQuantities?: Record<string, number>;
  initialCustomerId?: string | null;
  title?: string;
  confirmButtonLabel?: string;
  persistToLocalStorage?: boolean;
  initialPriceType?: PriceType;
}

function getInitialQuantities(productIds: string[], readFromStorage: boolean): Record<string, number> {
  if (readFromStorage && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.quantities);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const out: Record<string, number> = {};
        productIds.forEach((id) => { out[id] = typeof parsed[id] === "number" ? parsed[id] : 0; });
        return out;
      }
    } catch {}
  }
  return productIds.reduce((acc, id) => { acc[id] = 0; return acc; }, {} as Record<string, number>);
}

function getInitialPriceType(readFromStorage: boolean): PriceType {
  if (readFromStorage && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.priceType);
      if (stored && (["mayorista", "minorista", "fabrica"] as string[]).includes(stored)) return stored as PriceType;
    } catch {}
  }
  return "mayorista";
}

function getInitialCustomerId(customers: { id: string }[], readFromStorage: boolean): string | null {
  if (readFromStorage && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.customerId);
      if (stored && customers.some((c) => c.id === stored)) return stored;
    } catch {}
  }
  return null;
}

export function OrderCalculator({
  products,
  pricesByProductId,
  customers,
  onConfirmOrder,
  initialQuantities: initialQuantitiesProp,
  initialCustomerId: initialCustomerIdProp,
  initialPriceType: initialPriceTypeProp,
  title = "Nueva orden",
  confirmButtonLabel,
  persistToLocalStorage = true,
}: OrderCalculatorProps) {
  const [priceType, setPriceType] = useState<PriceType>(
    () => initialPriceTypeProp ?? getInitialPriceType(persistToLocalStorage),
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(() =>
    initialCustomerIdProp !== undefined
      ? initialCustomerIdProp
      : getInitialCustomerId(customers, persistToLocalStorage),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const ids = products.map((p) => p.id);
    if (initialQuantitiesProp && Object.keys(initialQuantitiesProp).length > 0) {
      return { ...getInitialQuantities(ids, persistToLocalStorage), ...initialQuantitiesProp };
    }
    return getInitialQuantities(ids, persistToLocalStorage);
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [mobTab, setMobTab] = useState<"products" | "summary">("products");
  const [mounted, setMounted] = useState(false);

  const productIds = useMemo(() => products.map((p) => p.id), [products]);
  const promoCategoryNames = useMemo(() => getPromoThresholdCategoryNames(), []);
  const promoVolumeTag = `+${Math.round(ORDER_PROMO_THRESHOLD_ARS / 1000)}k`;

  const { total, promoActive } = useMemo(
    () => computeOrderTotalWithPromo(products, quantities, pricesByProductId, priceType, promoCategoryNames),
    [products, quantities, pricesByProductId, priceType, promoCategoryNames],
  );

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev };
      let changed = false;
      productIds.forEach((id) => {
        if (next[id] === undefined) { next[id] = 0; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [productIds]);

  useEffect(() => {
    if (initialQuantitiesProp === undefined && initialCustomerIdProp === undefined) return;
    setQuantities((prev) => {
      const next = { ...prev };
      productIds.forEach((id) => { next[id] = initialQuantitiesProp?.[id] ?? next[id] ?? 0; });
      return next;
    });
    if (initialCustomerIdProp !== undefined) setSelectedCustomerId(initialCustomerIdProp);
  }, [initialQuantitiesProp, initialCustomerIdProp, productIds]);

  useEffect(() => {
    if (mounted && persistToLocalStorage) localStorage.setItem(STORAGE_KEYS.priceType, priceType);
  }, [priceType, mounted, persistToLocalStorage]);

  useEffect(() => {
    if (!mounted || !persistToLocalStorage) return;
    if (selectedCustomerId) localStorage.setItem(STORAGE_KEYS.customerId, selectedCustomerId);
    else localStorage.removeItem(STORAGE_KEYS.customerId);
  }, [selectedCustomerId, mounted, persistToLocalStorage]);

  useEffect(() => {
    if (mounted && persistToLocalStorage)
      localStorage.setItem(STORAGE_KEYS.quantities, JSON.stringify(quantities));
  }, [quantities, mounted, persistToLocalStorage]);

  const hasItems = products.some((p) => (quantities[p.id] ?? 0) > 0);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: qty }));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => { if (p.category?.name) cats.add(p.category.name); });
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(term));
    }
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category?.name === categoryFilter);
    }
    return list;
  }, [products, search, categoryFilter]);

  const summaryItems = useMemo(() => {
    return products
      .filter((p) => (quantities[p.id] ?? 0) > 0)
      .map((p) => {
        const qty = quantities[p.id] ?? 0;
        const prices = pricesByProductId[p.id] ?? [];
        const price = effectiveUnitPriceForOrderLine(p, prices, priceType, promoActive);
        return { productId: p.id, name: p.name, qty, price, subtotal: qty * price };
      });
  }, [products, quantities, pricesByProductId, priceType, promoActive]);

  const stockWarnings = useMemo(() => {
    return products.filter((p) => {
      const qty = quantities[p.id] ?? 0;
      return qty > 0 && qty > p.stock;
    });
  }, [products, quantities]);

  const customerNameForCopy = selectedCustomerId
    ? (customers.find((c) => c.id === selectedCustomerId)?.name ?? "")
    : "";

  const handleCopy = useCallback(() => {
    const nameLine = customerNameForCopy.trim() ? `Pedido para: ${customerNameForCopy.trim()}` : "Pedido";
    const parts: string[] = [nameLine, "", `Precio: ${PRICE_TYPE_LABELS[priceType].toUpperCase()}`, ""];
    const lines: { name: string; qty: number; subtotal: number }[] = [];
    products.forEach((p) => {
      const qty = quantities[p.id] ?? 0;
      if (qty <= 0) return;
      const prices = pricesByProductId[p.id] ?? [];
      const unitPrice = effectiveUnitPriceForOrderLine(p, prices, priceType, promoActive);
      lines.push({ name: p.name, qty, subtotal: qty * unitPrice });
    });
    lines.sort((a, b) => b.qty - a.qty);
    lines.forEach(({ name, qty, subtotal }) => {
      parts.push(`- ${qty} ${name} --> ${formatCurrency(subtotal)}`);
    });
    if (lines.length > 0) {
      parts.push("", "-------------------", `Total ${formatCurrency(total)}`);
    }
    if (lines.length === 0) { toast.error("Agregá al menos un ítem para copiar"); return; }
    navigator.clipboard
      .writeText(parts.join("\n"))
      .then(() => { if (navigator.vibrate) navigator.vibrate(30); toast.success("Pedido copiado"); })
      .catch(() => toast.error("No se pudo copiar"));
  }, [products, quantities, pricesByProductId, priceType, total, customerNameForCopy, promoActive]);

  const handleClear = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30);
    setSelectedCustomerId(null);
    setQuantities(productIds.reduce((acc, id) => { acc[id] = 0; return acc; }, {} as Record<string, number>));
  }, [productIds]);

  const handleConfirmOrder = useCallback(() => {
    if (!onConfirmOrder || !hasItems) return;
    if (!selectedCustomerId) {
      toast.error("Seleccioná un cliente antes de confirmar el pedido");
      return;
    }
    const items: { productId: string; quantity: number; price: number }[] = [];
    products.forEach((p) => {
      const qty = quantities[p.id] ?? 0;
      if (qty <= 0) return;
      const prices = pricesByProductId[p.id] ?? [];
      const unitPrice = effectiveUnitPriceForOrderLine(p, prices, priceType, promoActive);
      items.push({ productId: p.id, quantity: qty, price: unitPrice });
    });
    onConfirmOrder(items, total, selectedCustomerId, priceType);
  }, [onConfirmOrder, hasItems, products, quantities, pricesByProductId, priceType, total, selectedCustomerId, promoActive]);

  if (!mounted) {
    return <div className="ha-spin-wrap"><div className="ha-spin-el" /></div>;
  }

  return (
    <div className="oc-layout">
      <h1 className="oc-pagetitle">{title}</h1>

      {/* Mobile tabs */}
      <div className="oc-tabs">
        <button
          className={`oc-tab${mobTab === "products" ? " is-active" : ""}`}
          onClick={() => setMobTab("products")}
        >
          Productos
        </button>
        <button
          className={`oc-tab${mobTab === "summary" ? " is-active" : ""}`}
          onClick={() => setMobTab("summary")}
        >
          Resumen <span className="oc-tab__badge">{summaryItems.length}</span>
        </button>
      </div>

      <div className="oc-panels">
        {/* Left panel: products */}
        <section className={`oc-panel oc-panel--left${mobTab !== "products" ? " oc-panel--hidden" : ""}`}>
          <div className="oc-panel-head">
            <div className="oc-panel-head__info">
              <div className="oc-panel-title">Productos</div>
              <div className="oc-panel-sub">Seleccioná los productos para la orden</div>
            </div>
          </div>
          <div className="oc-toolbar">
            <div className="oc-srchwrap">
              <Search size={16} />
              <input
                placeholder="Buscar producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {categories.length > 0 && (
              <select
                className="oc-filtersel"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select
              className="oc-filtersel"
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as PriceType)}
            >
              {PRICE_TYPES.map((t) => (
                <option key={t} value={t}>{PRICE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="oc-plist">
            {filteredProducts.length === 0 ? (
              <div style={{ color: "var(--ha-text-3)", padding: "32px 20px", textAlign: "center", fontSize: 13 }}>
                {products.length === 0 ? "No hay productos cargados" : "Sin resultados"}
              </div>
            ) : (
              filteredProducts.map((product) => {
                const prices = pricesByProductId[product.id] ?? [];
                if (prices.length === 0) return null;
                const list = getPriceForType(prices, priceType);
                const effective = effectiveUnitPriceForOrderLine(product, prices, priceType, promoActive);
                const showPromo = promoActive && isPromoGiftComboName(product.name) && Math.abs(effective - list) > 0.02;
                return (
                  <ProductRow
                    key={product.id}
                    productId={product.id}
                    productName={product.name}
                    category={product.category?.name}
                    unit={product.unit}
                    stock={product.stock}
                    prices={prices}
                    priceType={priceType}
                    quantity={quantities[product.id] ?? 0}
                    onQuantityChange={(qty) => updateQuantity(product.id, qty)}
                    unitPriceOverride={showPromo ? effective : undefined}
                    listUnitPrice={list}
                    promoTag={showPromo ? promoVolumeTag : undefined}
                  />
                );
              })
            )}
          </div>
        </section>

        {/* Right panel: summary */}
        <section className={`oc-panel${mobTab !== "summary" ? " oc-panel--hidden" : ""}`}>
          <div className="oc-panel-head">
            <div className="oc-panel-head__info">
              <div className="oc-panel-title">Resumen</div>
            </div>
            <button
              className="ha-iconbtn"
              onClick={handleCopy}
              disabled={!hasItems}
              title="Copiar pedido"
              aria-label="Copiar pedido"
            >
              <Copy size={16} />
            </button>
            <button
              className="ha-iconbtn"
              onClick={handleClear}
              disabled={!hasItems}
              title="Limpiar"
              aria-label="Limpiar"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="oc-summary-body">
            {summaryItems.length === 0 ? (
              <div className="oc-empty-sum">Sin productos seleccionados.</div>
            ) : (
              summaryItems.map((item) => (
                <div key={item.productId} className="oc-sitem">
                  <div className="oc-sitem__info">
                    <div className="oc-sitem__name">{item.name}</div>
                    <div className="oc-sitem__calc">{item.qty} × {formatCurrency(item.price)}</div>
                  </div>
                  <div className="oc-sitem__sub">{formatCurrency(item.subtotal)}</div>
                  <button
                    className="oc-rmvbtn"
                    onClick={() => updateQuantity(item.productId, 0)}
                    aria-label="Eliminar"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Customer */}
          <div className="oc-sum-sect oc-sum-sect--bd">
            <label className="oc-sum-label">Cliente</label>
            <select
              className="oc-sum-sel"
              value={selectedCustomerId ?? ""}
              onChange={(e) => setSelectedCustomerId(e.target.value || null)}
            >
              <option value="">Sin cliente (anónima)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Stock warnings */}
          {stockWarnings.length > 0 && (
            <div className="oc-stock-warn">
              ⚠ {stockWarnings[0].name}: solo hay {stockWarnings[0].stock} unidades en stock.
              {stockWarnings.length > 1 && ` (+${stockWarnings.length - 1} más)`}
            </div>
          )}

          {/* Totals */}
          <div className="oc-sum-sect oc-sum-sect--bd">
            <div className="oc-sum-totrow">
              <span>Subtotal</span>
              <span className="mono">{formatCurrency(total)}</span>
            </div>
            <div className="oc-sum-totbig">
              <span className="l">Total</span>
              <span className="v">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Confirm */}
          <div className="oc-sum-foot">
            <button
              className="oc-confirm-btn"
              onClick={handleConfirmOrder}
              disabled={!hasItems || !onConfirmOrder}
            >
              {confirmButtonLabel ?? "Confirmar orden"} <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
