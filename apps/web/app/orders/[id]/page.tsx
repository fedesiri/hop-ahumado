"use client";

import { AppLayout } from "@/components/app-layout";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { App, Button, Card, Spin } from "antd";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { Order } from "@/lib/types";

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

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getOrder(id);
      setOrder(data);
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
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#ffffff" }}>Orden {order.id.slice(0, 8)}…</h1>
          <p style={{ margin: 0, color: "#9ca3af" }}>Creada: {new Date(order.createdAt).toLocaleString("es-AR")}</p>
        </div>
        <Link href="/orders">
          <Button icon={<ArrowLeftOutlined />}>Volver al listado</Button>
        </Link>
      </div>

      <OrderDetailView order={order} onOrderUpdated={setOrder} />
    </div>
  );
}
