"use client";

import { formatCurrency } from "@/lib/format-currency";
import {
  ORDER_PROMO_THRESHOLD_ARS,
  computeOrderTotalWithPromo,
  effectiveUnitPriceForOrderLine,
  getPromoThresholdCategoryNames,
  isPromoGiftComboName,
} from "@/lib/order-calculator/order-promo";
import { PRICE_TYPE_LABELS, getPriceForType, type PriceType } from "@/lib/order-calculator/price-types";
import { toast } from "@/lib/toast";
import type { Price, Product } from "@/lib/types";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PriceSelector } from "./price-selector";
import { ProductRow } from "./product-row";
import { StickyFooter } from "./sticky-footer";

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
      if (stored && ["mayorista", "minorista", "fabrica"].includes(stored)) return stored as PriceType;
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
  const [mounted, setMounted] = useState(false);

  const productIds = useMemo(() => products.map((p) => p.id), [products]);
  const promoCategoryNames = useMemo(() => getPromoThresholdCategoryNames(), []);
  const promoVolumeTag = `+${Math.round(ORDER_PROMO_THRESHOLD_ARS / 1000)}k`;

  const { total, thresholdSubtotal, promoActive } = useMemo(
    () => computeOrderTotalWithPromo(products, quantities, pricesByProductId, priceType, promoCategoryNames),
    [products, quantities, pricesByProductId, priceType, promoCategoryNames],
  );

  const promoFooterNote = useMemo(() => {
    if (priceType === "fabrica") return "Lista fábrica: no aplica la promo por umbral de compra.";
    const base =
      promoCategoryNames.length > 0
        ? `Subtotal para promo (categorías: ${promoCategoryNames.join(", ")}): ${formatCurrency(thresholdSubtotal)}. Umbral: ${formatCurrency(ORDER_PROMO_THRESHOLD_ARS)}.`
        : `Subtotal para promo (todo excepto Estuche/Copa y Estuche/Vaso): ${formatCurrency(thresholdSubtotal)}. Umbral: ${formatCurrency(ORDER_PROMO_THRESHOLD_ARS)}.`;
    return promoActive ? `${base} Aplicando precio promo en combos regalo (${promoVolumeTag}).` : base;
  }, [priceType, promoCategoryNames, thresholdSubtotal, promoActive, promoVolumeTag]);

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

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, search]);

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
    const text = parts.join("\n");
    if (lines.length === 0) { toast.error("Agregá al menos un ítem para copiar"); return; }
    navigator.clipboard
      .writeText(text)
      .then(() => { if (navigator.vibrate) navigator.vibrate(30); toast.success("Pedido copiado"); })
      .catch(() => toast.error("No se pudo copiar"));
  }, [products, quantities, pricesByProductId, priceType, total, customerNameForCopy, promoActive]);

  const handleClear = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30);
    setSelectedCustomerId(null);
    setQuantities(productIds.reduce((acc, id) => { acc[id] = 0; return acc; }, {} as Record<string, number>));
  }, [productIds]);

  const handleNewOrder = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30);
    setSelectedCustomerId(null);
    setQuantities(productIds.reduce((acc, id) => { acc[id] = 0; return acc; }, {} as Record<string, number>));
    setPriceType("mayorista");
    toast.info("Nueva orden");
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
    <div className="oc-screen">
      <div className="oc-scroll">
        <div className="oc-header">
          <div className="oc-htop">
            <h1 className="oc-title">{title}</h1>
          </div>
          <div className="oc-controls">
            <select
              className="oc-input ha-select"
              value={selectedCustomerId ?? ""}
              onChange={(e) => setSelectedCustomerId(e.target.value || null)}
            >
              <option value="">Cliente (opcional)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <PriceSelector selected={priceType} onSelect={setPriceType} />
            <div className="oc-input">
              <span className="oc-input__ic"><Search size={16} /></span>
              <input
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="oc-clear" onClick={() => setSearch("")}>✕</button>
              )}
            </div>
          </div>
        </div>

        <div className="oc-grid">
          {filteredProducts.length === 0 ? (
            <div className="oc-empty">
              <Search size={32} strokeWidth={1.5} />
              <p className="oc-empty__t">
                {products.length === 0 ? "No hay productos cargados" : "No se encontraron productos"}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const prices = pricesByProductId[product.id] ?? [];
              if (prices.length === 0) return null;
              const list = getPriceForType(prices, priceType);
              const effective = effectiveUnitPriceForOrderLine(product, prices, priceType, promoActive);
              const showPromoRow = promoActive && isPromoGiftComboName(product.name) && Math.abs(effective - list) > 0.02;
              return (
                <ProductRow
                  key={product.id}
                  productId={product.id}
                  productName={product.name}
                  prices={prices}
                  priceType={priceType}
                  quantity={quantities[product.id] ?? 0}
                  onQuantityChange={(qty) => updateQuantity(product.id, qty)}
                  unitPriceOverride={showPromoRow ? effective : undefined}
                  listUnitPrice={list}
                  promoTag={promoVolumeTag}
                />
              );
            })
          )}
        </div>
      </div>

      <StickyFooter
        total={total}
        hasItems={hasItems}
        onCopy={handleCopy}
        onClear={handleClear}
        onNewOrder={handleNewOrder}
        onConfirmOrder={onConfirmOrder ? handleConfirmOrder : undefined}
        confirmButtonLabel={confirmButtonLabel}
        footerNote={promoFooterNote}
      />
    </div>
  );
}
