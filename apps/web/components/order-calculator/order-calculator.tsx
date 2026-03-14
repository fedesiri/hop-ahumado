"use client";

import { PRICE_TYPE_LABELS, getPriceForType, type PriceType } from "@/lib/order-calculator/price-types";
import type { Price, Product } from "@/lib/types";
import { SearchOutlined } from "@ant-design/icons";
import { Col, Empty, Input, Row, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PriceSelector } from "./price-selector";
import { ProductRow } from "./product-row";
import { StickyFooter } from "./sticky-footer";

const STORAGE_KEYS = {
  priceType: "order-calc-price-type",
  customerName: "order-calc-customer-name",
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
  /** Si se pasa, se muestra el botón "Confirmar pedido" y se llama con ítems (productId, quantity, price) y total */
  onConfirmOrder?: (items: { productId: string; quantity: number; price: number }[], total: number) => void;
}

function getInitialQuantities(productIds: string[]): Record<string, number> {
  if (typeof window !== "undefined") {
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

function getInitialPriceType(): PriceType {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.priceType);
      if (stored && ["mayorista", "minorista", "fabrica"].includes(stored)) {
        return stored as PriceType;
      }
    } catch {}
  }
  return "mayorista";
}

function getInitialCustomerName(): string {
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem(STORAGE_KEYS.customerName) ?? "";
    } catch {}
  }
  return "";
}

export function OrderCalculator({ products, pricesByProductId, onConfirmOrder }: OrderCalculatorProps) {
  const [priceType, setPriceType] = useState<PriceType>(getInitialPriceType);
  const [customerName, setCustomerName] = useState(getInitialCustomerName);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    getInitialQuantities(products.map((p) => p.id)),
  );
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

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, search]);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEYS.priceType, priceType);
  }, [priceType, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEYS.customerName, customerName);
  }, [customerName, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEYS.quantities, JSON.stringify(quantities));
  }, [quantities, mounted]);

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

  const handleCopy = useCallback(() => {
    const nameLine = customerName.trim() ? `Pedido para: ${customerName.trim()}` : "Pedido";
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
      parts.push(`- ${qty} ${name} --> ${subtotal.toLocaleString("es-AR")}`);
    });
    if (lines.length > 0) {
      parts.push("");
      parts.push("-------------------");
      parts.push(`Total $${total.toLocaleString("es-AR")}`);
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
  }, [products, quantities, pricesByProductId, priceType, total, customerName]);

  const handleClear = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30);
    setCustomerName("");
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
    setCustomerName("");
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
    toast.info("Nuevo pedido");
  }, [productIds]);

  const handleConfirmOrder = useCallback(() => {
    if (!onConfirmOrder || !hasItems) return;
    const items: { productId: string; quantity: number; price: number }[] = [];
    products.forEach((p) => {
      const qty = quantities[p.id] ?? 0;
      if (qty <= 0) return;
      const prices = pricesByProductId[p.id] ?? [];
      const unitPrice = getPriceForType(prices, priceType);
      items.push({ productId: p.id, quantity: qty, price: unitPrice });
    });
    onConfirmOrder(items, total);
  }, [onConfirmOrder, hasItems, products, quantities, pricesByProductId, priceType, total]);

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
          <h1 style={{ margin: "0 0 12px 0", color: "#ffffff", fontSize: 18 }}>Calculadora de Pedidos</h1>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12} lg={6}>
              <Input
                placeholder="Nombre del cliente (opcional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                allowClear
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
      />
    </div>
  );
}
