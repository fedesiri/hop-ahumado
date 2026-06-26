"use client";

import { OrderDetailView } from "@/components/orders/order-detail-view";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { Order } from "@/lib/types";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = use(params);
  return <OrderDetailContent id={id} />;
}

function OrderDetailContent({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getOrder(id);
      setOrder(data);
    } catch {
      toast.error("Error al cargar la orden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Link href="/orders" className="ha-btn ha-btn--secondary ha-btn--sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <ArrowLeft size={15} /> Volver al listado
          </Link>
        </div>
        <div style={{ background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, padding: 24 }}>
          <p style={{ color: "var(--ha-text-3)", margin: 0 }}>No se encontró la orden.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, color: "var(--ha-text)", fontSize: 22, fontWeight: 700 }}>Orden {order.id.slice(0, 8)}…</h1>
          <p style={{ margin: 0, color: "var(--ha-text-3)", fontSize: 13 }}>Creada: {new Date(order.createdAt).toLocaleString("es-AR")}</p>
        </div>
        <Link href="/orders" className="ha-btn ha-btn--secondary ha-btn--sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <ArrowLeft size={15} /> Volver al listado
        </Link>
      </div>

      <OrderDetailView order={order} onOrderUpdated={setOrder} />
    </div>
  );
}
