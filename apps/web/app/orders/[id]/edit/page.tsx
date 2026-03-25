"use client";

import { AppLayout } from "@/components/app-layout";
import { OrderCalculator } from "@/components/order-calculator/order-calculator";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import dayjs, { type Dayjs } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import { inferPriceTypeFromOrderLines } from "@/lib/order-calculator/price-types";
import type { Customer, Order, Price, Product } from "@/lib/types";
import { PaymentMethod } from "@/lib/types";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, App, Button, DatePicker, Modal, Select, Spin } from "antd";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";

interface OrderEditPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderEditPage({ params }: OrderEditPageProps) {
  const { id } = use(params);
  return (
    <LineProvider>
      <AppLayout>
        <OrderEditPageContent id={id} />
      </AppLayout>
    </LineProvider>
  );
}

function OrderEditPageContent({ id }: { id: string }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    items: { productId: string; quantity: number; price: number }[];
    total: number;
    customerId: string | null;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pricesByProductId = useMemo(() => {
    const map: Record<string, Price[]> = {};
    prices.forEach((price) => {
      if (!map[price.productId]) map[price.productId] = [];
      map[price.productId].push(price);
    });
    return map;
  }, [prices]);

  const initialQuantities = useMemo(() => {
    if (!order?.orderItems?.length) return undefined;
    const m: Record<string, number> = {};
    for (const oi of order.orderItems) {
      m[oi.productId] = (m[oi.productId] ?? 0) + oi.quantity;
    }
    return m;
  }, [order]);

  const oldQtyByProduct = useMemo(() => {
    if (!order?.orderItems?.length) return {} as Record<string, number>;
    const m: Record<string, number> = {};
    for (const oi of order.orderItems) {
      m[oi.productId] = (m[oi.productId] ?? 0) + oi.quantity;
    }
    return m;
  }, [order]);

  /** Misma lista de precios que al crear el pedido (mayorista/minorista/fábrica), inferida de las líneas guardadas */
  const inferredPriceType = useMemo(() => {
    if (!order?.orderItems?.length || !prices.length) return undefined;
    return inferPriceTypeFromOrderLines(order.orderItems, pricesByProductId);
  }, [order, prices.length, pricesByProductId]);

  const productsGoingNegative = useMemo(() => {
    if (!pendingOrder) return [];
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const result: { name: string; current: number; requested: number; after: number }[] = [];
    for (const item of pendingOrder.items) {
      const product = productById[item.productId];
      if (!product) continue;
      const released = oldQtyByProduct[item.productId] ?? 0;
      const effective = product.stock + released;
      const after = effective - item.quantity;
      if (after < 0) {
        result.push({
          name: product.name,
          current: effective,
          requested: item.quantity,
          after,
        });
      }
    }
    return result;
  }, [pendingOrder, products, oldQtyByProduct]);

  const limit = 100;

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
        const orderData = await apiClient.getOrder(id);
        setOrder(orderData);
        if (orderData.payments?.[0]?.method) {
          setPaymentMethod(orderData.payments[0].method);
        }
        setDeliveryDate(orderData.deliveryDate ? dayjs(orderData.deliveryDate) : null);

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
        setPrices(allPrices);

        const allCustomers: Customer[] = [];
        page = 1;
        let customersRes = await apiClient.getCustomers(page, limit);
        allCustomers.push(...customersRes.data);
        while (customersRes.meta.totalPages > page) {
          page += 1;
          customersRes = await apiClient.getCustomers(page, limit);
          allCustomers.push(...customersRes.data);
        }
        setCustomers(allCustomers);
      } catch (e) {
        console.error(e);
        message.error("Error al cargar la orden o los datos");
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, message, fetchProducts]);

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

  const handleSaveOrder = async () => {
    if (!pendingOrder || !order) return;
    const { items, total, customerId } = pendingOrder;
    setSubmitting(true);
    try {
      await apiClient.updateOrder(id, {
        customerId: customerId ?? undefined,
        userId: order.userId ?? user?.id ?? undefined,
        deliveryDate:
          deliveryDate?.toISOString() ?? (order.deliveryDate ? new Date(order.deliveryDate).toISOString() : undefined),
        total,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
        payments: [{ amount: Number(total), method: paymentMethod }],
      });
      message.success("Orden actualizada. El stock se ajustó correctamente.");
      setConfirmModalOpen(false);
      setPendingOrder(null);
      const updated = await apiClient.getOrder(id);
      setOrder(updated);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Error al actualizar la orden";
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

  if (!order) {
    return (
      <div>
        <Link href="/orders">
          <Button icon={<ArrowLeftOutlined />}>Volver al listado</Button>
        </Link>
        <p style={{ marginTop: 24, color: "#9ca3af" }}>No se pudo cargar la orden.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/orders">
          <Button icon={<ArrowLeftOutlined />}>Volver al listado</Button>
        </Link>
      </div>

      {prices.length === 0 ? (
        <p style={{ padding: 24, color: "#f87171" }}>
          No hay precios cargados en el sistema. Sin precios no se puede inferir la lista ni armar la edición.
        </p>
      ) : (
        <OrderCalculator
          key={order.id}
          products={products}
          pricesByProductId={pricesByProductId}
          customers={customers}
          onConfirmOrder={handleConfirmOrder}
          initialQuantities={initialQuantities}
          initialCustomerId={order.customerId ?? null}
          initialPriceType={inferredPriceType}
          title="Editar orden"
          confirmButtonLabel="Guardar cambios (ajustar stock)"
          persistToLocalStorage={false}
        />
      )}

      <Modal
        title="Confirmar cambios"
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
          <Button key="submit" type="primary" loading={submitting} onClick={handleSaveOrder}>
            Guardar orden
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
              <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>Fecha de entrega</label>
              <DatePicker
                style={{ width: "100%" }}
                value={deliveryDate}
                onChange={(v) => setDeliveryDate(v)}
                format="DD/MM/YYYY"
              />
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
                      Tras devolver el stock de esta orden, los productos indicados quedarían por debajo de cero. Se
                      aplicará igual (misma política que al crear la orden).
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {productsGoingNegative.map((p) => (
                        <li key={p.name}>
                          <strong>{p.name}</strong>: disponible tras devolver esta orden {p.current}, pedido{" "}
                          {p.requested} → quedará {p.after}
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
                { label: "Transferencia", value: PaymentMethod.CARD },
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
