"use client";

import { AppLayout } from "@/components/app-layout";
import { OrderCalculator } from "@/components/order-calculator/order-calculator";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import dayjs, { type Dayjs } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { PriceType } from "@/lib/order-calculator/price-types";
import {
  expandOrderLineDemands,
  fetchRecipesByProductIds,
  type RecipeIngredientRow,
} from "@/lib/order-calculator/stock-preview";
import type { CreateOrderRequest, Customer, Price, Product, StockLocation } from "@/lib/types";
import { PaymentMethod } from "@/lib/types";
import { Alert, App, Button, DatePicker, Input, Modal, Select, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function OrderCalculatorPage() {
  return (
    <LineProvider>
      <AppLayout>
        <OrderCalculatorPageContent />
      </AppLayout>
    </LineProvider>
  );
}

function OrderCalculatorPageContent() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calculatorKey, setCalculatorKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    items: { productId: string; quantity: number; price: number }[];
    total: number;
    customerId: string | null;
    priceListType: PriceType;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState<string | null>(null);
  const [orderComment, setOrderComment] = useState("");
  const [balanceByProductId, setBalanceByProductId] = useState<Record<string, number>>({});
  const [recipesByProductId, setRecipesByProductId] = useState<Record<string, RecipeIngredientRow[]>>({});
  const [stockPreviewReady, setStockPreviewReady] = useState(false);

  const pricesByProductId = useMemo(() => {
    const map: Record<string, Price[]> = {};
    prices.forEach((price) => {
      if (!map[price.productId]) map[price.productId] = [];
      map[price.productId].push(price);
    });
    return map;
  }, [prices]);

  /** Stock en la ubicación elegida: para combos usa ingredientes (misma lógica que el backend al descontar). */
  const productsGoingNegative = useMemo(() => {
    if (!pendingOrder || !fulfillmentLocationId || !stockPreviewReady) return [];
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const demand = expandOrderLineDemands(pendingOrder.items, recipesByProductId);
    const result: { name: string; current: number; requested: number; after: number }[] = [];
    for (const [productId, need] of Object.entries(demand)) {
      if (need <= 0) continue;
      const product = productById[productId];
      const atLocation = balanceByProductId[productId] ?? 0;
      const after = atLocation - need;
      if (after < 0) {
        result.push({
          name: product?.name ?? productId,
          current: atLocation,
          requested: need,
          after,
        });
      }
    }
    return result;
  }, [pendingOrder, products, fulfillmentLocationId, balanceByProductId, recipesByProductId, stockPreviewReady]);

  const limit = 100; // máximo que permite la API

  const fetchProducts = useCallback(async () => {
    const allProducts: Product[] = [];
    let page = 1;
    let res = await apiClient.getProducts(page, limit);
    allProducts.push(...res.data);
    while (res.meta.totalPages > page) {
      page += 1;
      res = await apiClient.getProducts(page, limit);
      allProducts.push(...res.data);
    }
    setProducts(allProducts);
    return allProducts;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchProducts();

        const allPrices: Price[] = [];
        let page = 1;
        let pricesRes = await apiClient.getPrices(page, limit, undefined, true);
        allPrices.push(...pricesRes.data);
        while (pricesRes.meta.totalPages > page) {
          page += 1;
          pricesRes = await apiClient.getPrices(page, limit, undefined, true);
          allPrices.push(...pricesRes.data);
        }

        const allCustomers: Customer[] = [];
        page = 1;
        let customersRes = await apiClient.getCustomers(page, limit);
        allCustomers.push(...customersRes.data);
        while (customersRes.meta.totalPages > page) {
          page += 1;
          customersRes = await apiClient.getCustomers(page, limit);
          allCustomers.push(...customersRes.data);
        }

        setPrices(allPrices);
        setCustomers(allCustomers);

        try {
          const locs = await apiClient.getStockLocations();
          setStockLocations(locs);
          const def = locs.find((l) => l.isDefault)?.id ?? locs[0]?.id ?? null;
          setFulfillmentLocationId(def);
        } catch {
          setStockLocations([]);
          setFulfillmentLocationId(null);
        }
      } catch (e) {
        console.error(e);
        message.error("Error al cargar productos y precios");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [message, fetchProducts]);

  // Al abrir el modal: productos, saldos en ubicación y recetas (para avisar stock en combos por insumo)
  useEffect(() => {
    if (!confirmModalOpen) {
      setStockPreviewReady(false);
      setRecipesByProductId({});
      return;
    }
    if (!pendingOrder || !fulfillmentLocationId) return;
    let cancelled = false;
    setStockPreviewReady(false);
    fetchProducts();
    (async () => {
      try {
        const ids = [...new Set(pendingOrder.items.map((i) => i.productId))];
        const [rows, recipes] = await Promise.all([
          apiClient.getStockBalancesAtLocation(fulfillmentLocationId),
          fetchRecipesByProductIds((p, l, id) => apiClient.getRecipeItems(p, l, id), ids),
        ]);
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const r of rows) map[r.productId] = Number(r.quantity);
        setBalanceByProductId(map);
        setRecipesByProductId(recipes);
        setStockPreviewReady(true);
      } catch {
        if (!cancelled) {
          setBalanceByProductId({});
          setRecipesByProductId({});
          setStockPreviewReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmModalOpen, pendingOrder, fulfillmentLocationId, fetchProducts]);

  const handleConfirmOrder = (
    items: { productId: string; quantity: number; price: number }[],
    total: number,
    customerId?: string | null,
    priceListType?: PriceType,
  ) => {
    setOrderComment("");
    setDeliveryDate(dayjs().startOf("day"));
    setPendingOrder({
      items,
      total,
      customerId: customerId ?? null,
      priceListType: priceListType ?? "mayorista",
    });
    setConfirmModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!pendingOrder) return;
    if (stockLocations.length > 0 && !fulfillmentLocationId) {
      message.error("Elegí la ubicación de stock desde la cual descontar el pedido.");
      return;
    }
    const { items, total, customerId, priceListType } = pendingOrder;
    setSubmitting(true);
    try {
      const data: CreateOrderRequest = {
        customerId: customerId ?? undefined,
        userId: user?.id,
        deliveryDate: (deliveryDate ?? dayjs().startOf("day")).toISOString(),
        fulfillmentLocationId: fulfillmentLocationId ?? undefined,
        total,
        priceListType,
        ...(orderComment.trim() ? { comment: orderComment.trim() } : {}),
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
        payments: [{ amount: Number(total), method: paymentMethod }],
      };
      await apiClient.createOrder(data);
      message.success("Orden creada. El stock se descontó correctamente.");
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("order-calc-quantities");
          localStorage.removeItem("order-calc-customer-id");
          localStorage.removeItem("order-calc-price-type");
        } catch {}
      }
      setCalculatorKey((prev) => prev + 1);
      setConfirmModalOpen(false);
      setPendingOrder(null);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Error al crear la orden";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <OrderCalculator
        key={calculatorKey}
        products={products}
        pricesByProductId={pricesByProductId}
        customers={customers}
        onConfirmOrder={handleConfirmOrder}
      />

      <Modal
        title="Confirmar pedido"
        open={confirmModalOpen}
        onCancel={() => {
          setConfirmModalOpen(false);
          setPendingOrder(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setConfirmModalOpen(false);
              setPendingOrder(null);
            }}
          >
            Cancelar
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleCreateOrder}>
            Crear orden y descontar stock
          </Button>,
        ]}
      >
        {pendingOrder && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ marginBottom: 8, color: "#9ca3af" }}>Total: {formatCurrency(pendingOrder.total)}</p>
            <p style={{ marginBottom: 8, color: "#9ca3af" }}>Ítems: {pendingOrder.items.length}</p>
            {pendingOrder.customerId && (
              <p style={{ marginBottom: 8, color: "#9ca3af" }}>
                Cliente: {customers.find((c) => c.id === pendingOrder.customerId)?.name ?? pendingOrder.customerId}
              </p>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>
                Ubicación de stock (desde dónde se descuenta)
              </label>
              <Select
                style={{ width: "100%" }}
                placeholder="Elegí ubicación"
                value={fulfillmentLocationId ?? undefined}
                onChange={(v) => setFulfillmentLocationId(v)}
                options={stockLocations.map((l) => ({
                  label: l.isDefault ? `${l.name} (predeterminada)` : l.name,
                  value: l.id,
                }))}
              />
              {stockLocations.length === 0 && (
                <p style={{ marginTop: 8, color: "#f87171", fontSize: 13 }}>
                  No hay ubicaciones cargadas. Ejecutá la migración de base y/o creá ubicaciones en Stock → Ubicaciones.
                </p>
              )}
            </div>
            {productsGoingNegative.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Stock insuficiente"
                description={
                  <>
                    <p style={{ marginBottom: 8 }}>
                      En la ubicación elegida no alcanza el stock. Se descontará igual (puede quedar negativo en esa
                      ubicación). El total del producto en todas las ubicaciones sigue en la ficha del producto.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {productsGoingNegative.map((p) => (
                        <li key={p.name}>
                          <strong>{p.name}</strong>: stock actual {p.current}, pedido {p.requested} → quedará {p.after}
                        </li>
                      ))}
                    </ul>
                  </>
                }
              />
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>Fecha de entrega</label>
              <DatePicker
                style={{ width: "100%" }}
                value={deliveryDate}
                onChange={(v) => setDeliveryDate(v)}
                format="DD/MM/YYYY"
              />
            </div>
            <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>Método de pago</label>
            <Select
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v)}
              style={{ width: "100%" }}
              options={[
                { label: "Efectivo", value: PaymentMethod.CASH },
                { label: "Transferencia", value: PaymentMethod.CARD },
              ]}
            />
            <div style={{ marginTop: 12, marginBottom: 28 }}>
              <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>
                Comentario del pedido (opcional)
              </label>
              <Input.TextArea
                value={orderComment}
                onChange={(e) => setOrderComment(e.target.value)}
                placeholder="Ej. horario de retiro, instrucciones especiales…"
                rows={3}
                maxLength={2000}
                showCount
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
