"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { orderPaymentStatusLabel } from "@/lib/order-labels";
import { OrderPaymentStatus, PaymentMethod, type Order, type OrderItem, type OrderPayment } from "@/lib/types";
import { App, Button, Card, Col, InputNumber, Modal, Row, Select, Space, Spin, Table as AntTable, Tag } from "antd";
import { useEffect, useState } from "react";

type Props = {
  order: Order;
  onOrderUpdated: (order: Order) => void;
};

type CobrarItem = {
  orderItemId: string;
  price: number | null;
  quantitySold: number | null;
  unsoldDisposition: "RETURN_TO_STOCK" | "KEEP_ON_CONSIGNMENT" | null;
};

type DevolverItem = {
  orderItemId: string;
  quantity: number | null;
};

export function OrderDetailView({ order, onOrderUpdated }: Props) {
  const { message } = App.useApp();
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [addingPayment, setAddingPayment] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  // Cobrar modal state
  const [cobrarModalOpen, setCobrarModalOpen] = useState(false);
  const [cobrarItems, setCobrarItems] = useState<CobrarItem[]>([]);
  const [cobrarPaymentAmount, setCobrarPaymentAmount] = useState<number | null>(null);
  const [cobrarPaymentMethod, setCobrarPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cobrarLoading, setCobrarLoading] = useState(false);
  const [cobrarPricesLoading, setCobrarPricesLoading] = useState(false);

  // Devolver modal state
  const [devolverModalOpen, setDevolverModalOpen] = useState(false);
  const [devolverItems, setDevolverItems] = useState<DevolverItem[]>([]);
  const [devolverLoading, setDevolverLoading] = useState(false);

  useEffect(() => {
    const r = Number(order.remainingAmount ?? 0);
    setPaymentAmount(r > 0 ? r : null);
  }, [order.id, order.remainingAmount]);

  const openCobrarModal = async () => {
    const pendingItems = (order.orderItems ?? []).filter((i) => i.price === null || i.price === undefined);
    const initialItems: CobrarItem[] = pendingItems.map((i) => ({
      orderItemId: i.id,
      price: null,
      quantitySold: Number(i.quantity),
      unsoldDisposition: null,
    }));
    setCobrarItems(initialItems);
    setCobrarPaymentAmount(null);
    setCobrarPaymentMethod(PaymentMethod.CASH);
    setCobrarModalOpen(true);
    setCobrarPricesLoading(true);
    try {
      const pricesRes = await apiClient.getPrices(1, 100, undefined, true);
      const listType = order.priceListType?.trim().toLowerCase();
      const priceByProductId = new Map<string, number>();
      for (const p of pricesRes.data) {
        const existing = priceByProductId.get(p.productId);
        const desc = p.description?.trim().toLowerCase() ?? null;
        const isMatch = listType ? desc === listType : true;
        if (existing === undefined) {
          priceByProductId.set(p.productId, Number(p.value));
        } else if (isMatch) {
          priceByProductId.set(p.productId, Number(p.value));
        }
      }
      setCobrarItems(
        pendingItems.map((i) => ({
          orderItemId: i.id,
          price: priceByProductId.get(i.productId) ?? null,
          quantitySold: Number(i.quantity),
          unsoldDisposition: null,
        })),
      );
    } catch {
      // precios no disponibles, el usuario los ingresa manualmente
    } finally {
      setCobrarPricesLoading(false);
    }
  };

  const cobrarTotal = cobrarItems.reduce((sum, i) => {
    const oi = (order.orderItems ?? []).find((oi) => oi.id === i.orderItemId);
    const qty = i.quantitySold ?? Number(oi?.quantity ?? 0);
    return sum + (i.price ?? 0) * qty;
  }, 0);

  useEffect(() => {
    if (cobrarModalOpen && cobrarTotal > 0) {
      setCobrarPaymentAmount(cobrarTotal);
    }
  }, [cobrarTotal, cobrarModalOpen]);

  const handleCobrar = async () => {
    const hasUnpricedItem = cobrarItems.some((i) => i.price === null || i.price < 0);
    if (hasUnpricedItem) {
      message.error("Ingresá el precio para todos los ítems antes de confirmar");
      return;
    }
    for (const i of cobrarItems) {
      const oi = (order.orderItems ?? []).find((oi) => oi.id === i.orderItemId);
      const qty = i.quantitySold ?? Number(oi?.quantity ?? 0);
      if (qty < Number(oi?.quantity ?? 0) && !i.unsoldDisposition) {
        message.error("Seleccioná qué hacer con las unidades no vendidas de cada ítem");
        return;
      }
    }
    setCobrarLoading(true);
    try {
      let updatedOrder = await apiClient.setConsignmentPrices(order.id, {
        items: cobrarItems.map((i) => {
          const oi = (order.orderItems ?? []).find((oi) => oi.id === i.orderItemId);
          const sold = i.quantitySold ?? Number(oi?.quantity ?? 0);
          const full = Number(oi?.quantity ?? 0);
          const isPartial = sold < full;
          return {
            orderItemId: i.orderItemId,
            price: i.price!,
            ...(isPartial && {
              quantitySold: sold,
              unsoldDisposition: i.unsoldDisposition!,
            }),
          };
        }),
      });
      if (
        cobrarPaymentAmount &&
        cobrarPaymentAmount > 0 &&
        updatedOrder.paymentStatus !== OrderPaymentStatus.PENDING_PRICING
      ) {
        updatedOrder = await apiClient.createOrderPayment(order.id, {
          amount: cobrarPaymentAmount,
          method: cobrarPaymentMethod,
        });
      }
      onOrderUpdated(updatedOrder);
      setCobrarModalOpen(false);
      const stillPending = updatedOrder.paymentStatus === OrderPaymentStatus.PENDING_PRICING;
      message.success(
        stillPending
          ? "Precios fijados. Los ítems restantes quedan en consignación."
          : "Consignación cobrada",
      );
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "No se pudo registrar el cobro";
      message.error(msg);
    } finally {
      setCobrarLoading(false);
    }
  };

  const openDevolverModal = () => {
    const pendingItems = (order.orderItems ?? []).filter((i) => i.price === null || i.price === undefined);
    setDevolverItems(pendingItems.map((i) => ({ orderItemId: i.id, quantity: Number(i.quantity) })));
    setDevolverModalOpen(true);
  };

  const handleDevolver = async () => {
    const itemsToReturn = devolverItems.filter((i) => i.quantity && i.quantity > 0);
    if (itemsToReturn.length === 0) {
      message.error("Ingresá al menos una cantidad mayor a 0 para devolver");
      return;
    }
    setDevolverLoading(true);
    try {
      const updated = await apiClient.returnConsignment(order.id, {
        items: itemsToReturn.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity! })),
      });
      onOrderUpdated(updated);
      setDevolverModalOpen(false);
      message.success("Devolución registrada");
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "No se pudo registrar la devolución";
      message.error(msg);
    } finally {
      setDevolverLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || paymentAmount <= 0) return;
    try {
      setAddingPayment(true);
      const updated = await apiClient.createOrderPayment(order.id, {
        amount: Number(paymentAmount),
        method: paymentMethod,
      });
      onOrderUpdated(updated);
      const nextRemaining = Number(updated.remainingAmount ?? 0);
      setPaymentAmount(nextRemaining > 0 ? nextRemaining : null);
      message.success("Pago registrado");
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "No se pudo registrar el pago";
      message.error(msg);
    } finally {
      setAddingPayment(false);
    }
  };

  const handleUpdatePaymentMethod = async (paymentId: string, method: PaymentMethod) => {
    if (order.payments?.find((p) => p.id === paymentId)?.method === method) return;
    try {
      setUpdatingPaymentId(paymentId);
      const updated = await apiClient.updateOrderPayment(order.id, paymentId, { method });
      onOrderUpdated(updated);
      message.success("Medio de pago actualizado");
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "No se pudo actualizar el medio de pago";
      message.error(msg);
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const isCancelled = order.paymentStatus === OrderPaymentStatus.CANCELLED;
  const isPendingPricing = order.isConsignment && order.paymentStatus === OrderPaymentStatus.PENDING_PRICING;
  const pendingOrderItems = (order.orderItems ?? []).filter((i) => i.price === null || i.price === undefined);

  const itemColumns = [
    { title: "Producto", dataIndex: ["product", "name"], key: "product" },
    ...(order.isConsignment
      ? [
          {
            title: "Consignado",
            key: "originalQuantity",
            render: (_: unknown, record: OrderItem) =>
              record.originalQuantity != null ? formatQuantity(record.originalQuantity) : "—",
          },
        ]
      : []),
    {
      title: "Cantidad",
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number) => formatQuantity(q),
    },
    {
      title: "Precio",
      dataIndex: "price",
      key: "price",
      render: (v: number | string | null) => (v === null || v === undefined ? "—" : formatCurrency(v)),
    },
    {
      title: "Subtotal",
      key: "subtotal",
      render: (_: unknown, record: OrderItem) =>
        record.price === null || record.price === undefined
          ? "—"
          : formatCurrency(Number(record.price) * Number(record.quantity)),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16, background: "#1f2937" }}>
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={12}>
            <strong>Cliente:</strong> {order.customer?.name || "—"}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Vendedor:</strong> {order.user?.name || "—"}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Total:</strong> {formatCurrency(order.total)}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Total calculado:</strong> {formatCurrency(order.totalPrice)}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Estado de pago:</strong>{" "}
            <Tag
              color={
                order.paymentStatus === OrderPaymentStatus.PAID
                  ? "green"
                  : order.paymentStatus === OrderPaymentStatus.PARTIALLY_PAID
                    ? "gold"
                    : order.paymentStatus === OrderPaymentStatus.PENDING_PRICING
                      ? "orange"
                      : order.paymentStatus === OrderPaymentStatus.CANCELLED
                        ? "red"
                        : "default"
              }
            >
              {orderPaymentStatusLabel(order.paymentStatus)}
            </Tag>
            {order.isConsignment && <Tag color="purple" style={{ marginLeft: 4 }}>Consignación</Tag>}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Pagado:</strong> {formatCurrency(order.paidAmount)}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Pendiente:</strong> {formatCurrency(order.remainingAmount)}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Lista de precios:</strong> {orderPriceListDisplayLabel(order.priceListType)}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Creada:</strong> {new Date(order.createdAt).toLocaleDateString("es-AR")}
          </Col>
          {isCancelled && order.cancelledAt && (
            <Col xs={24} sm={12}>
              <strong>Cancelada el:</strong>{" "}
              <span style={{ color: "#ef4444" }}>
                {new Date(order.cancelledAt).toLocaleDateString("es-AR")}
              </span>
            </Col>
          )}
          <Col xs={24} sm={12}>
            <strong>Entrega programada:</strong>{" "}
            {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—"}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Entregada:</strong> {order.isDelivered ? "Sí" : "No"}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Entregada el:</strong>{" "}
            {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString("es-AR") : "—"}
          </Col>
          <Col xs={24} sm={12}>
            <strong>Ubicación de stock:</strong> {order.fulfillmentLocation?.name ?? "—"}
          </Col>
          {order.comment ? (
            <Col xs={24}>
              <strong>Comentario:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{order.comment}</span>
            </Col>
          ) : null}
        </Row>
      </Card>

      <h3 style={{ color: "#ffffff" }}>Ítems</h3>
      <AntTable
        style={{ marginBottom: 24 }}
        columns={itemColumns}
        dataSource={(order.orderItems || []) as OrderItem[]}
        rowKey="id"
        pagination={false}
      />

      <h3 style={{ color: "#ffffff" }}>Pagos</h3>

      {isPendingPricing ? (
        <Card style={{ marginBottom: 16, background: "#1f2937" }}>
          <p style={{ color: "#9ca3af", marginBottom: 12 }}>
            Esta orden está pendiente de cobro. Ingresá los precios del día para cada ítem y registrá el pago.
          </p>
          <Space wrap>
            <Button type="primary" onClick={openCobrarModal}>
              Cobrar consignación
            </Button>
            <Button onClick={openDevolverModal}>
              Registrar devolución
            </Button>
          </Space>
        </Card>
      ) : isCancelled ? (
        <Card style={{ marginBottom: 16, background: "#1f2937" }}>
          <p style={{ color: "#9ca3af" }}>
            Esta orden fue cancelada. No se pueden registrar pagos ni devoluciones.
          </p>
        </Card>
      ) : (
        <Card style={{ marginBottom: 16, background: "#1f2937" }}>
          <Space wrap>
            <InputNumber
              min={0.01}
              value={paymentAmount ?? undefined}
              onChange={(v) => setPaymentAmount(v ?? null)}
              placeholder="Monto"
              disabled={order.paymentStatus === OrderPaymentStatus.PAID}
            />
            <Select
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v)}
              style={{ width: 200 }}
              options={[
                { label: "Efectivo", value: PaymentMethod.CASH },
                { label: "Transferencia", value: PaymentMethod.CARD },
              ]}
              disabled={order.paymentStatus === OrderPaymentStatus.PAID}
            />
            <Button
              type="primary"
              onClick={() => void handleAddPayment()}
              loading={addingPayment}
              disabled={order.paymentStatus === OrderPaymentStatus.PAID || !paymentAmount || paymentAmount <= 0}
            >
              Registrar pago
            </Button>
          </Space>
        </Card>
      )}

      <AntTable
        columns={[
          {
            title: "Medio",
            dataIndex: "method",
            key: "method",
            width: 220,
            render: (_: unknown, record: OrderPayment) => (
              <Select
                size="small"
                value={record.method}
                style={{ minWidth: 180 }}
                loading={updatingPaymentId === record.id}
                disabled={updatingPaymentId !== null}
                onChange={(v) => void handleUpdatePaymentMethod(record.id, v as PaymentMethod)}
                options={[
                  { label: "Efectivo", value: PaymentMethod.CASH },
                  { label: "Transferencia", value: PaymentMethod.CARD },
                ]}
                aria-label="Medio de pago"
              />
            ),
          },
          {
            title: "Monto",
            dataIndex: "amount",
            key: "amount",
            render: (v: number | string) => formatCurrency(v),
          },
        ]}
        dataSource={(order.payments || []) as OrderPayment[]}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: "Sin pagos registrados" }}
      />

      {/* Modal Cobrar consignación */}
      <Modal
        title="Cobrar consignación"
        open={cobrarModalOpen}
        onCancel={() => setCobrarModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCobrarModalOpen(false)}>
            Cancelar
          </Button>,
          <Button key="confirm" type="primary" loading={cobrarLoading} onClick={() => void handleCobrar()}>
            Confirmar cobro
          </Button>,
        ]}
      >
        <p style={{ color: "#9ca3af", marginBottom: 16 }}>
          Precios pre-llenados con la lista activa ({(order.priceListType as string) ?? "mayorista"}). Podés editarlos antes de confirmar.
        </p>
        {cobrarPricesLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#9ca3af" }}>
            <Spin size="small" /> Cargando precios actuales…
          </div>
        )}
        <AntTable
          size="small"
          pagination={false}
          style={{ marginBottom: 16 }}
          dataSource={pendingOrderItems.map((oi) => {
            const ci = cobrarItems.find((c) => c.orderItemId === oi.id);
            return { ...oi, cobrarPrice: ci?.price ?? null, cobrarQty: ci?.quantitySold ?? Number(oi.quantity), cobrarDisposition: ci?.unsoldDisposition ?? null };
          })}
          rowKey="id"
          columns={[
            { title: "Producto", dataIndex: ["product", "name"], key: "product" },
            {
              title: "Disponible",
              dataIndex: "quantity",
              key: "quantity",
              render: (q: number) => formatQuantity(q),
            },
            {
              title: "Cant. vendida",
              key: "cantVendida",
              render: (_: unknown, record: OrderItem & { cobrarQty: number; cobrarDisposition: string | null }) => (
                <InputNumber
                  min={0}
                  max={Number(record.quantity)}
                  value={record.cobrarQty}
                  onChange={(v) =>
                    setCobrarItems((prev) =>
                      prev.map((i) =>
                        i.orderItemId === record.id
                          ? { ...i, quantitySold: v ?? 0, unsoldDisposition: v === Number(record.quantity) ? null : i.unsoldDisposition }
                          : i,
                      ),
                    )
                  }
                  style={{ width: 80 }}
                />
              ),
            },
            {
              title: "Remanente",
              key: "remanente",
              render: (_: unknown, record: OrderItem & { cobrarQty: number; cobrarDisposition: string | null }) => {
                const sold = record.cobrarQty;
                const remaining = Number(record.quantity) - sold;
                if (remaining <= 0) return <span style={{ color: "#6b7280" }}>—</span>;
                return (
                  <Select
                    placeholder="¿Qué hacemos?"
                    value={record.cobrarDisposition ?? undefined}
                    style={{ width: 170 }}
                    onChange={(v) =>
                      setCobrarItems((prev) =>
                        prev.map((i) =>
                          i.orderItemId === record.id ? { ...i, unsoldDisposition: v as "RETURN_TO_STOCK" | "KEEP_ON_CONSIGNMENT" } : i,
                        ),
                      )
                    }
                    options={[
                      { label: "Devolver al stock", value: "RETURN_TO_STOCK" },
                      { label: "Dejar en consignación", value: "KEEP_ON_CONSIGNMENT" },
                    ]}
                  />
                );
              },
            },
            {
              title: "Precio unitario",
              key: "price",
              render: (_: unknown, record: OrderItem & { cobrarPrice: number | null }) => (
                <InputNumber
                  min={0}
                  value={record.cobrarPrice ?? undefined}
                  placeholder="0.00"
                  onChange={(v) =>
                    setCobrarItems((prev) =>
                      prev.map((i) => (i.orderItemId === record.id ? { ...i, price: v ?? null } : i)),
                    )
                  }
                  style={{ width: 110 }}
                />
              ),
            },
          ]}
        />
        <div style={{ marginBottom: 16 }}>
          <strong style={{ color: "#e5e7eb" }}>Total: {formatCurrency(cobrarTotal)}</strong>
        </div>
        <Space wrap>
          <InputNumber
            min={0.01}
            value={cobrarPaymentAmount ?? undefined}
            onChange={(v) => setCobrarPaymentAmount(v ?? null)}
            placeholder="Monto del pago"
          />
          <Select
            value={cobrarPaymentMethod}
            onChange={(v) => setCobrarPaymentMethod(v)}
            style={{ width: 180 }}
            options={[
              { label: "Efectivo", value: PaymentMethod.CASH },
              { label: "Transferencia", value: PaymentMethod.CARD },
            ]}
          />
        </Space>
        <p style={{ color: "#9ca3af", marginTop: 8, fontSize: 12 }}>
          Dejá el monto en blanco si querés fijar los precios sin registrar el pago todavía.
        </p>
      </Modal>

      {/* Modal Registrar devolución */}
      <Modal
        title="Registrar devolución"
        open={devolverModalOpen}
        onCancel={() => setDevolverModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setDevolverModalOpen(false)}>
            Cancelar
          </Button>,
          <Button key="confirm" danger loading={devolverLoading} onClick={() => void handleDevolver()}>
            Confirmar devolución
          </Button>,
        ]}
      >
        <p style={{ color: "#9ca3af", marginBottom: 16 }}>
          Ingresá la cantidad que devuelve el cliente por cada ítem. El stock se reincorporará al inventario.
        </p>
        <AntTable
          size="small"
          pagination={false}
          style={{ marginBottom: 16 }}
          dataSource={pendingOrderItems.map((oi) => ({
            ...oi,
            devolverQty: devolverItems.find((d) => d.orderItemId === oi.id)?.quantity ?? Number(oi.quantity),
          }))}
          rowKey="id"
          columns={[
            { title: "Producto", dataIndex: ["product", "name"], key: "product" },
            {
              title: "En consignación",
              dataIndex: "quantity",
              key: "quantity",
              render: (q: number) => formatQuantity(q),
            },
            {
              title: "Cant. a devolver",
              key: "cantDevolver",
              render: (_: unknown, record: OrderItem & { devolverQty: number }) => (
                <InputNumber
                  min={0}
                  max={Number(record.quantity)}
                  value={record.devolverQty}
                  onChange={(v) =>
                    setDevolverItems((prev) =>
                      prev.map((d) => (d.orderItemId === record.id ? { ...d, quantity: v ?? 0 } : d)),
                    )
                  }
                  style={{ width: 100 }}
                />
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
