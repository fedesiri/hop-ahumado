"use client";

import { formatCurrency } from "@/lib/format-currency";
import { PRICE_TYPE_LABELS, getPriceForType, type PriceType } from "@/lib/order-calculator/price-types";
import type { Price, Product } from "@/lib/types";
import { SearchOutlined } from "@ant-design/icons";
import { Col, Empty, Input, Row, Select, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PriceSelector } from "./price-selector";
import { ProductRow } from "./product-row";
import { StickyFooter } from "./sticky-footer";

const STORAGE_KEYS = {
  priceType: "order-calc-price-type",
  customerId: "order-calc-customer-id",
  quantities: "order-calc-quantities",
};

const SECTION_STYLE: React.CSSProperties = {
  borderBottom: "1px solid #2d3748",
  backgroundColor: "rgba(10, 10, 10, 0.95)",
  padding: "12px 16px",
  position: "sticky",
  top: 0,
  zIndex: 40,
};

const CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
};

export interface OrderCalculatorProps {
  /** Productos cargados desde la API */
  products: Product[];
  /** Precios por productId (agrupados desde la API) */
  pricesByProductId: Record<string, Price[]>;
  /** Clientes de la DB para elegir en la calculadora */
  customers: { id: string; name: string }[];
  /** Si se pasa, se muestra el botón "Confirmar pedido"; se llama con ítems, total y customerId (opcional) */
  onConfirmOrder?: (
    items: { productId: string; quantity: number; price: number }[],
    total: number,
    customerId?: string | null,
  ) => void;
  /** Cantidades iniciales por productId (p. ej. al editar una orden) */
  initialQuantities?: Record<string, number>;
  /** Cliente inicial (p. ej. orden en edición) */
  initialCustomerId?: string | null;
  /** Título de la pantalla */
  title?: string;
  /** Texto del botón de confirmar en el footer */
  confirmButtonLabel?: string;
  /** Si es false, no persiste tipo de precio / cliente / cantidades en localStorage */
  persistToLocalStorage?: boolean;
  /** Si se pasa (p. ej. inferido desde las líneas de una orden), evita caer siempre en mayorista sin localStorage */
  initialPriceType?: PriceType;
}

function getInitialQuantities(productIds: string[], readFromStorage: boolean): Record<string, number> {
  if (readFromStorage && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.quantities);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const out: Record<string, number> = {};
        productIds.forEach((id) => {
          out[id] = typeof parsed[id] === "number" ? parsed[id] : 0;
        });
        return out;
      }
    } catch {}
  }
  return productIds.reduce(
    (acc, id) => {
      acc[id] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );
}

function getInitialPriceType(readFromStorage: boolean): PriceType {
  if (readFromStorage && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.priceType);
      if (stored && ["mayorista", "minorista", "fabrica"].includes(stored)) {
        return stored as PriceType;
      }
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev };
      let changed = false;
      productIds.forEach((id) => {
        if (next[id] === undefined) {
          next[id] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [productIds]);

  useEffect(() => {
    if (initialQuantitiesProp === undefined && initialCustomerIdProp === undefined) return;
    setQuantities((prev) => {
      const next = { ...prev };
      productIds.forEach((id) => {
        next[id] = initialQuantitiesProp?.[id] ?? next[id] ?? 0;
      });
      return next;
    });
    if (initialCustomerIdProp !== undefined) {
      setSelectedCustomerId(initialCustomerIdProp);
    }
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
    if (mounted && persistToLocalStorage) localStorage.setItem(STORAGE_KEYS.quantities, JSON.stringify(quantities));
  }, [quantities, mounted, persistToLocalStorage]);

  const total = useMemo(() => {
    return products.reduce((sum, p) => {
      const qty = quantities[p.id] ?? 0;
      if (qty <= 0) return sum;
      const prices = pricesByProductId[p.id] ?? [];
      const unitPrice = getPriceForType(prices, priceType);
      return sum + qty * unitPrice;
    }, 0);
  }, [products, quantities, pricesByProductId, priceType]);

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
      const unitPrice = getPriceForType(prices, priceType);
      lines.push({ name: p.name, qty, subtotal: qty * unitPrice });
    });
    lines.sort((a, b) => b.qty - a.qty);
    lines.forEach(({ name, qty, subtotal }) => {
      parts.push(`- ${qty} ${name} --> ${formatCurrency(subtotal)}`);
    });
    if (lines.length > 0) {
      parts.push("");
      parts.push("-------------------");
      parts.push(`Total ${formatCurrency(total)}`);
    }
    const text = parts.join("\n");
    if (text === nameLine + "\n\n" + `Precio: ${PRICE_TYPE_LABELS[priceType].toUpperCase()}\n\n`) {
      toast.error("Agregá al menos un ítem para copiar");
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        toast.success("Pedido copiado");
      })
      .catch(() => toast.error("No se pudo copiar"));
  }, [products, quantities, pricesByProductId, priceType, total, customerNameForCopy]);

  const handleClear = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30);
    setSelectedCustomerId(null);
    setQuantities(
      productIds.reduce(
        (acc, id) => {
          acc[id] = 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
    );
  }, [productIds]);

  const handleNewOrder = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30);
    setSelectedCustomerId(null);
    setQuantities(
      productIds.reduce(
        (acc, id) => {
          acc[id] = 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
    );
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
      const unitPrice = getPriceForType(prices, priceType);
      items.push({ productId: p.id, quantity: qty, price: unitPrice });
    });
    onConfirmOrder(items, total, selectedCustomerId);
  }, [onConfirmOrder, hasItems, products, quantities, pricesByProductId, priceType, total, selectedCustomerId]);

  if (!mounted) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 140 }}>
      {/* Header: título + filtros */}
      <div style={SECTION_STYLE}>
        <div style={CONTAINER_STYLE}>
          <h1 style={{ margin: "0 0 12px 0", color: "#ffffff", fontSize: 18 }}>{title}</h1>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12} lg={6}>
              <Select
                placeholder="Cliente"
                value={selectedCustomerId || undefined}
                onChange={(v) => setSelectedCustomerId(v ?? null)}
                allowClear
                style={{ width: "100%" }}
                options={customers.map((c) => ({ label: c.name, value: c.id }))}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())
                }
              />
            </Col>
            <Col xs={24} md={12} lg={10}>
              <PriceSelector selected={priceType} onSelect={setPriceType} />
            </Col>
            <Col xs={24} lg={8}>
              <Input
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
                allowClear
              />
            </Col>
          </Row>
        </div>
      </div>

      {/* Lista de productos */}
      <main style={{ padding: "16px", ...CONTAINER_STYLE }}>
        {filteredProducts.length === 0 ? (
          <Empty
            description={products.length === 0 ? "No hay productos cargados" : "No se encontraron productos"}
            style={{ color: "#9ca3af", marginTop: 48 }}
          />
        ) : (
          <Row gutter={[12, 12]}>
            {filteredProducts.map((product) => {
              const prices = pricesByProductId[product.id] ?? [];
              if (prices.length === 0) return null;
              return (
                <Col xs={24} sm={24} md={12} xl={8} key={product.id}>
                  <ProductRow
                    productId={product.id}
                    productName={product.name}
                    prices={prices}
                    priceType={priceType}
                    quantity={quantities[product.id] ?? 0}
                    onQuantityChange={(qty) => updateQuantity(product.id, qty)}
                  />
                </Col>
              );
            })}
          </Row>
        )}
      </main>

      <StickyFooter
        total={total}
        hasItems={hasItems}
        onCopy={handleCopy}
        onClear={handleClear}
        onNewOrder={handleNewOrder}
        onConfirmOrder={onConfirmOrder ? handleConfirmOrder : undefined}
        confirmButtonLabel={confirmButtonLabel}
      />
    </div>
  );
}
