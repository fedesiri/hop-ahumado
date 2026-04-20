"use client";

import { AppLayout } from "@/components/app-layout";
import { OrderCalculator } from "@/components/order-calculator/order-calculator";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import dayjs, { type Dayjs } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import { inferPriceTypeFromOrderLines, parsePriceListType, type PriceType } from "@/lib/order-calculator/price-types";
import {
  expandOrderLineDemands,
  fetchRecipesByProductIds,
  type RecipeIngredientRow,
} from "@/lib/order-calculator/stock-preview";
import type { Customer, Order, Price, Product, StockLocation } from "@/lib/types";
import { PaymentMethod } from "@/lib/types";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, App, Button, DatePicker, Input, Modal, Select, Spin } from "antd";
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

  const initialQuantities = useMemo(() => {
    if (!order?.orderItems?.length) return undefined;
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
    if (!pendingOrder || !fulfillmentLocationId || !stockPreviewReady || !order?.orderItems) return [];
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const oldItems = order.orderItems.map((oi) => ({ productId: oi.productId, quantity: oi.quantity }));
    const newDemand = expandOrderLineDemands(pendingOrder.items, recipesByProductId);
    const oldDemand = expandOrderLineDemands(oldItems, recipesByProductId);
    const allIds = new Set([...Object.keys(newDemand), ...Object.keys(oldDemand)]);
    const result: { name: string; current: number; requested: number; after: number }[] = [];
    for (const productId of allIds) {
      const need = newDemand[productId] ?? 0;
      const released = oldDemand[productId] ?? 0;
      const atLocation = balanceByProductId[productId] ?? 0;
      const effective = atLocation + released;
      const after = effective - need;
      if (after < 0) {
        const product = productById[productId];
        result.push({
          name: product?.name ?? productId,
          current: effective,
          requested: need,
          after,
        });
      }
    }
    return result;
  }, [pendingOrder, products, order, fulfillmentLocationId, balanceByProductId, recipesByProductId, stockPreviewReady]);

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
        setOrderComment(orderData.comment ?? "");

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

        try {
          const locs = await apiClient.getStockLocations();
          setStockLocations(locs);
          const fromOrder = orderData.fulfillmentLocationId;
          const def = fromOrder ?? locs.find((l) => l.isDefault)?.id ?? locs[0]?.id ?? null;
          setFulfillmentLocationId(def);
        } catch {
          setStockLocations([]);
          setFulfillmentLocationId(orderData.fulfillmentLocationId ?? null);
        }
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
    if (!confirmModalOpen) {
      setStockPreviewReady(false);
      setRecipesByProductId({});
      return;
    }
    if (!pendingOrder || !fulfillmentLocationId || !order?.orderItems) return;
    let cancelled = false;
    setStockPreviewReady(false);
    fetchProducts();
    (async () => {
      try {
        const ids = new Set<string>();
        pendingOrder.items.forEach((i) => ids.add(i.productId));
        order.orderItems!.forEach((oi) => ids.add(oi.productId));
        const [rows, recipes] = await Promise.all([
          apiClient.getStockBalancesAtLocation(fulfillmentLocationId),
          fetchRecipesByProductIds((p, l, id) => apiClient.getRecipeItems(p, l, id), [...ids]),
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
  }, [confirmModalOpen, pendingOrder, fulfillmentLocationId, fetchProducts, order?.orderItems]);

  const handleConfirmOrder = (
    items: { productId: string; quantity: number; price: number }[],
    total: number,
    customerId?: string | null,
    priceListType?: PriceType,
  ) => {
    setPendingOrder({
      items,
      total,
      customerId: customerId ?? null,
      priceListType: priceListType ?? inferredPriceType ?? "mayorista",
    });
    setConfirmModalOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!pendingOrder || !order) return;
    if (stockLocations.length > 0 && !fulfillmentLocationId) {
      message.error("Elegí la ubicación de stock desde la cual descontar el pedido.");
      return;
    }
    const { items, total, customerId, priceListType } = pendingOrder;
    setSubmitting(true);
    try {
      await apiClient.updateOrder(id, {
        customerId: customerId ?? undefined,
        userId: order.userId ?? user?.id ?? undefined,
        deliveryDate:
          deliveryDate?.toISOString() ?? (order.deliveryDate ? new Date(order.deliveryDate).toISOString() : undefined),
        fulfillmentLocationId: fulfillmentLocationId ?? undefined,
        total,
        priceListType,
        comment: orderComment,
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
          initialPriceType={parsePriceListType(order.priceListType) ?? inferredPriceType ?? "mayorista"}
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
              <label style={{ display: "block", marginBottom: 4, color: "#9ca3af" }}>
                Ubicación de stock (desde dónde se descuenta)
              </label>
              <Select
                style={{ width: "100%" }}
                value={fulfillmentLocationId ?? undefined}
                onChange={(v) => setFulfillmentLocationId(v)}
                options={stockLocations.map((l) => ({
                  label: l.isDefault ? `${l.name} (predeterminada)` : l.name,
                  value: l.id,
                }))}
              />
            </div>
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
