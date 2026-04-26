"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { orderPaymentStatusLabel } from "@/lib/order-labels";
import { OrderPaymentStatus, PaymentMethod, type Order, type OrderItem, type OrderPayment } from "@/lib/types";
import { App, Button, Card, Col, InputNumber, Row, Select, Space, Table as AntTable, Tag } from "antd";
import { useEffect, useState } from "react";

type Props = {
  order: Order;
  onOrderUpdated: (order: Order) => void;
};

export function OrderDetailView({ order, onOrderUpdated }: Props) {
  const { message } = App.useApp();
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [addingPayment, setAddingPayment] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const r = Number(order.remainingAmount ?? 0);
    setPaymentAmount(r > 0 ? r : null);
  }, [order.id, order.remainingAmount]);

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
                    : "default"
              }
            >
              {orderPaymentStatusLabel(order.paymentStatus)}
            </Tag>
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
        columns={[
          { title: "Producto", dataIndex: ["product", "name"], key: "product" },
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
            render: (v: number | string) => formatCurrency(v),
          },
          {
            title: "Subtotal",
            key: "subtotal",
            render: (_: unknown, record: OrderItem) => formatCurrency(Number(record.price) * Number(record.quantity)),
          },
        ]}
        dataSource={(order.orderItems || []) as OrderItem[]}
        rowKey="id"
        pagination={false}
      />

      <h3 style={{ color: "#ffffff" }}>Pagos</h3>
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
    </div>
  );
}
