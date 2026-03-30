"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { Order, OrderItem, OrderPayment } from "@/lib/types";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Table as AntTable, App, Button, Card, Col, Row, Spin } from "antd";
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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getOrder(id);
        setOrder(data);
      } catch (error) {
        console.error(error);
        message.error("Error al cargar la orden");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, message]);

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
            <strong>Fecha de entrega:</strong>{" "}
            {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "-"}
          </Col>
          <Col span={12}>
            <strong>Ubicación de stock:</strong> {order.fulfillmentLocation?.name ?? "—"}
          </Col>
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
