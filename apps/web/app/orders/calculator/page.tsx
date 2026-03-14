"use client";

import { AppLayout } from "@/components/app-layout";
import { OrderCalculator } from "@/components/order-calculator/order-calculator";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import type { CreateOrderRequest, Customer, Price, Product } from "@/lib/types";
import { App, Button, Modal, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";

export default function OrderCalculatorPage() {
  return (
    <LineProvider>
      <AppLayout showLineTabs={false}>
        <OrderCalculatorPageContent />
      </AppLayout>
    </LineProvider>
  );
}

function OrderCalculatorPageContent() {
  const { message } = App.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    items: { productId: string; quantity: number; price: number }[];
    total: number;
  } | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pricesByProductId = useMemo(() => {
    const map: Record<string, Price[]> = {};
    prices.forEach((price) => {
      if (!map[price.productId]) map[price.productId] = [];
      map[price.productId].push(price);
    });
    return map;
  }, [prices]);

  useEffect(() => {
    const limit = 100; // máximo que permite la API

    const load = async () => {
      try {
        setLoading(true);

        const allProducts: Product[] = [];
        let page = 1;
        let res = await apiClient.getProducts(page, limit);
        allProducts.push(...res.data);
        while (res.meta.totalPages > page) {
          page += 1;
          res = await apiClient.getProducts(page, limit);
          allProducts.push(...res.data);
        }

        const allPrices: Price[] = [];
        page = 1;
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

        setProducts(allProducts);
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
  }, [message]);

  const handleConfirmOrder = (items: { productId: string; quantity: number; price: number }[], total: number) => {
    setPendingOrder({ items, total });
    setSelectedCustomerId(null);
    setConfirmModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!pendingOrder) return;
    const { items, total } = pendingOrder;
    setSubmitting(true);
    try {
      const data: CreateOrderRequest = {
        customerId: selectedCustomerId ?? undefined,
        total,
        items,
        payments: [{ amount: total, method: "CASH" }],
      };
      await apiClient.createOrder(data);
      message.success("Orden creada. El stock se descontó correctamente.");
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
      <OrderCalculator products={products} pricesByProductId={pricesByProductId} onConfirmOrder={handleConfirmOrder} />

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
            <p style={{ marginBottom: 8, color: "#9ca3af" }}>Total: $ {pendingOrder.total.toLocaleString("es-AR")}</p>
            <p style={{ marginBottom: 8, color: "#9ca3af" }}>Ítems: {pendingOrder.items.length}</p>
            <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>Cliente (opcional)</label>
            <Select
              placeholder="Seleccionar cliente"
              allowClear
              style={{ width: "100%" }}
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              options={customers.map((c) => ({ label: c.name, value: c.id }))}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
