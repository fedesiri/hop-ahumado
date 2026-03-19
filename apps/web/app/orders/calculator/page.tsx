"use client";

import { AppLayout } from "@/components/app-layout";
import { OrderCalculator } from "@/components/order-calculator/order-calculator";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { CreateOrderRequest, Customer, Price, Product } from "@/lib/types";
import { PaymentMethod } from "@/lib/types";
import { Alert, App, Button, Modal, Select, Spin } from "antd";
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
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [submitting, setSubmitting] = useState(false);

  const pricesByProductId = useMemo(() => {
    const map: Record<string, Price[]> = {};
    prices.forEach((price) => {
      if (!map[price.productId]) map[price.productId] = [];
      map[price.productId].push(price);
    });
    return map;
  }, [prices]);

  /** Productos que quedarían con stock negativo (según stock actual en DB; se refresca al abrir el modal) */
  const productsGoingNegative = useMemo(() => {
    if (!pendingOrder) return [];
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const result: { name: string; current: number; requested: number; after: number }[] = [];
    for (const item of pendingOrder.items) {
      const product = productById[item.productId];
      if (!product) continue;
      const after = product.stock - item.quantity;
      if (after < 0) {
        result.push({
          name: product.name,
          current: product.stock,
          requested: item.quantity,
          after,
        });
      }
    }
    return result;
  }, [pendingOrder, products]);

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
      } catch (e) {
        console.error(e);
        message.error("Error al cargar productos y precios");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [message, fetchProducts]);

  // Al abrir el modal de confirmar pedido, refrescar productos desde la DB para que el aviso de stock negativo use datos actuales
  useEffect(() => {
    if (confirmModalOpen && pendingOrder) {
      fetchProducts();
    }
  }, [confirmModalOpen, pendingOrder, fetchProducts]);

  const handleConfirmOrder = (
    items: { productId: string; quantity: number; price: number }[],
    total: number,
    customerId?: string | null,
  ) => {
    setPendingOrder({ items, total, customerId: customerId ?? null });
    setConfirmModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!pendingOrder) return;
    const { items, total, customerId } = pendingOrder;
    setSubmitting(true);
    try {
      const data: CreateOrderRequest = {
        customerId: customerId ?? undefined,
        userId: user?.id,
        total,
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
            {productsGoingNegative.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Stock insuficiente"
                description={
                  <>
                    <p style={{ marginBottom: 8 }}>
                      Los siguientes productos no tienen stock suficiente. Se descontará igual y quedarán en número
                      negativo. Cuando cargues nuevo stock (entrada), ese número negativo se descontará de lo que
                      ingreses.
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
            <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>Método de pago</label>
            <Select
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v)}
              style={{ width: "100%" }}
              options={[
                { label: "Efectivo", value: PaymentMethod.CASH },
                { label: "Tarjeta/Transferencia", value: PaymentMethod.CARD },
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
