"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { OrderPaymentStatus, PaymentMethod, type Order, type OrderItem, type OrderPayment } from "@/lib/types";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Table as AntTable, App, Button, Card, Col, InputNumber, Row, Select, Space, Spin, Tag } from "antd";
import Link from "next/link";
import { use, useEffect, useState } from "react";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = use(params);
  return (
    <LineProvider>
      <AppLayout>
        <OrderDetailContent id={id} />
      </AppLayout>
    </LineProvider>
  );
}

function OrderDetailContent({ id }: { id: string }) {
  const { message } = App.useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [addingPayment, setAddingPayment] = useState(false);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getOrder(id);
      setOrder(data);
      const remaining = Number(data.remainingAmount ?? 0);
      setPaymentAmount(remaining > 0 ? remaining : null);
    } catch (error) {
      console.error(error);
      message.error("Error al cargar la orden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [id, message]);

  const handleAddPayment = async () => {
    if (!order || !paymentAmount || paymentAmount <= 0) return;
    try {
      setAddingPayment(true);
      const updated = await apiClient.createOrderPayment(order.id, {
        amount: Number(paymentAmount),
        method: paymentMethod,
      });
      setOrder(updated);
      const remaining = Number(updated.remainingAmount ?? 0);
      setPaymentAmount(remaining > 0 ? remaining : null);
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
        <div style={{ marginBottom: 16 }}>
          <Link href="/orders">
            <Button icon={<ArrowLeftOutlined />}>Volver al listado</Button>
          </Link>
        </div>
        <Card style={{ background: "#1f2937" }}>
          <p style={{ color: "#9ca3af" }}>No se encontró la orden.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, color: "#ffffff" }}>Orden {order.id.slice(0, 8)}...</h1>
          <p style={{ margin: 0, color: "#9ca3af" }}>Fecha: {new Date(order.createdAt).toLocaleDateString("es-AR")}</p>
        </div>
        <Link href="/orders">
          <Button icon={<ArrowLeftOutlined />}>Volver al listado</Button>
        </Link>
      </div>

      <Card style={{ marginBottom: 16, background: "#1f2937" }}>
        <Row gutter={16}>
          <Col span={12}>
            <strong>Cliente:</strong> {order.customer?.name || "-"}
          </Col>
          <Col span={12}>
            <strong>Vendedor:</strong> {order.user?.name || "-"}
          </Col>
          <Col span={12}>
            <strong>Total:</strong> {formatCurrency(order.total)}
          </Col>
          <Col span={12}>
            <strong>Total calculado:</strong> {formatCurrency(order.totalPrice)}
          </Col>
          <Col span={12}>
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
              {order.paymentStatus}
            </Tag>
          </Col>
          <Col span={12}>
            <strong>Pagado:</strong> {formatCurrency(order.paidAmount)}
          </Col>
          <Col span={12}>
            <strong>Pendiente:</strong> {formatCurrency(order.remainingAmount)}
          </Col>
          <Col span={12}>
            <strong>Lista de precios:</strong> {orderPriceListDisplayLabel(order.priceListType)}
          </Col>
          <Col span={12}>
            <strong>Fecha de entrega:</strong>{" "}
            {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "-"}
          </Col>
          <Col span={12}>
            <strong>Entregado:</strong> {order.isDelivered ? "Sí" : "No"}
          </Col>
          <Col span={12}>
            <strong>Entregado en:</strong>{" "}
            {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString("es-AR") : "-"}
          </Col>
          <Col span={12}>
            <strong>Ubicación de stock:</strong> {order.fulfillmentLocation?.name ?? "—"}
          </Col>
          {order.comment ? (
            <Col span={24}>
              <strong>Comentario:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{order.comment}</span>
            </Col>
          ) : null}
        </Row>
      </Card>

      <h3 style={{ color: "#ffffff" }}>Ítems</h3>
      <AntTable
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
        style={{ marginBottom: 24 }}
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
            style={{ width: 180 }}
            options={[
              { label: "Efectivo", value: PaymentMethod.CASH },
              { label: "Transferencia", value: PaymentMethod.CARD },
            ]}
            disabled={order.paymentStatus === OrderPaymentStatus.PAID}
          />
          <Button
            type="primary"
            onClick={handleAddPayment}
            loading={addingPayment}
            disabled={order.paymentStatus === OrderPaymentStatus.PAID || !paymentAmount || paymentAmount <= 0}
          >
            Agregar pago
          </Button>
        </Space>
      </Card>
      <AntTable
        columns={[
          {
            title: "Método",
            dataIndex: "method",
            key: "method",
            render: (v: string) => (v === "CASH" ? "Efectivo" : "Transferencia"),
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
      />
    </div>
  );
}
