"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { orderPaymentStatusLabel } from "@/lib/order-labels";
import { toast } from "@/lib/toast";
import {
  OrderPaymentStatus,
  PaymentMethod,
  type Order,
} from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

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

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  [OrderPaymentStatus.PAID]: "#4ade80",
  [OrderPaymentStatus.PARTIALLY_PAID]: "#fbbf24",
  [OrderPaymentStatus.PENDING_PRICING]: "#f97316",
  [OrderPaymentStatus.CANCELLED]: "#f87171",
};

function statusBadge(status: string) {
  const color = PAYMENT_STATUS_COLOR[status] ?? "var(--ha-text-3)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {orderPaymentStatusLabel(status)}
    </span>
  );
}

function Spinner() {
  return (
    <span
      style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite", verticalAlign: "middle" }}
    />
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ha-text-3)", fontWeight: 600, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--ha-text)", lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 12px" }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ha-text-3)", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--ha-border)" }} />
    </div>
  );
}

export function OrderDetailView({ order, onOrderUpdated }: Props) {
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [addingPayment, setAddingPayment] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  const [itemsExpanded, setItemsExpanded] = useState(true);

  const [cobrarModalOpen, setCobrarModalOpen] = useState(false);
  const [cobrarItems, setCobrarItems] = useState<CobrarItem[]>([]);
  const [cobrarPaymentAmount, setCobrarPaymentAmount] = useState<string>("");
  const [cobrarPaymentMethod, setCobrarPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cobrarLoading, setCobrarLoading] = useState(false);
  const [cobrarPricesLoading, setCobrarPricesLoading] = useState(false);

  const [devolverModalOpen, setDevolverModalOpen] = useState(false);
  const [devolverItems, setDevolverItems] = useState<DevolverItem[]>([]);
  const [devolverLoading, setDevolverLoading] = useState(false);

  useEffect(() => {
    const r = Number(order.remainingAmount ?? 0);
    setPaymentAmount(r > 0 ? String(r) : "");
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
    setCobrarPaymentAmount("");
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
      setCobrarPaymentAmount(String(cobrarTotal));
    }
  }, [cobrarTotal, cobrarModalOpen]);

  const handleCobrar = async () => {
    if (cobrarItems.some((i) => i.price === null || i.price < 0)) {
      toast.error("Ingresá el precio para todos los ítems antes de confirmar");
      return;
    }
    for (const i of cobrarItems) {
      const oi = (order.orderItems ?? []).find((oi) => oi.id === i.orderItemId);
      const qty = i.quantitySold ?? Number(oi?.quantity ?? 0);
      if (qty < Number(oi?.quantity ?? 0) && !i.unsoldDisposition) {
        toast.error("Seleccioná qué hacer con las unidades no vendidas de cada ítem");
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
      const amt = Number(cobrarPaymentAmount);
      if (amt > 0 && updatedOrder.paymentStatus !== OrderPaymentStatus.PENDING_PRICING) {
        updatedOrder = await apiClient.createOrderPayment(order.id, {
          amount: amt,
          method: cobrarPaymentMethod,
        });
      }
      onOrderUpdated(updatedOrder);
      setCobrarModalOpen(false);
      const stillPending = updatedOrder.paymentStatus === OrderPaymentStatus.PENDING_PRICING;
      toast.success(stillPending ? "Precios fijados. Los ítems restantes quedan en consignación." : "Consignación cobrada");
    } catch (error: unknown) {
      const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "No se pudo registrar el cobro";
      toast.error(msg);
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
      toast.error("Ingresá al menos una cantidad mayor a 0 para devolver");
      return;
    }
    setDevolverLoading(true);
    try {
      const updated = await apiClient.returnConsignment(order.id, {
        items: itemsToReturn.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity! })),
      });
      onOrderUpdated(updated);
      setDevolverModalOpen(false);
      toast.success("Devolución registrada");
    } catch (error: unknown) {
      const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "No se pudo registrar la devolución";
      toast.error(msg);
    } finally {
      setDevolverLoading(false);
    }
  };

  const handleAddPayment = async () => {
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) return;
    try {
      setAddingPayment(true);
      const updated = await apiClient.createOrderPayment(order.id, { amount: amt, method: paymentMethod });
      onOrderUpdated(updated);
      const nextRemaining = Number(updated.remainingAmount ?? 0);
      setPaymentAmount(nextRemaining > 0 ? String(nextRemaining) : "");
      toast.success("Pago registrado");
    } catch (error: unknown) {
      const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "No se pudo registrar el pago";
      toast.error(msg);
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
      toast.success("Medio de pago actualizado");
    } catch (error: unknown) {
      const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "No se pudo actualizar el medio de pago";
      toast.error(msg);
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const isCancelled = order.paymentStatus === OrderPaymentStatus.CANCELLED;
  const isPendingPricing = order.isConsignment && order.paymentStatus === OrderPaymentStatus.PENDING_PRICING;
  const pendingOrderItems = (order.orderItems ?? []).filter((i) => i.price === null || i.price === undefined);
  const isPaid = order.paymentStatus === OrderPaymentStatus.PAID;
  const remaining = Number(order.remainingAmount ?? 0);

  return (
    <div>
      {/* Info card */}
      <div style={{ marginBottom: 4, padding: "16px 20px", borderRadius: 12, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)" }}>
        {/* Header row: customer + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ha-text)" }}>{order.customer?.name || "Sin cliente"}</span>
          {statusBadge(order.paymentStatus)}
          {order.isConsignment && (
            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, background: "#7c3aed22", color: "#a78bfa", border: "1px solid #7c3aed55" }}>
              Consignación
            </span>
          )}
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--ha-border)" }}>
          {([
            { label: "Total", value: formatCurrency(order.total), color: undefined },
            { label: "Pagado", value: formatCurrency(order.paidAmount), color: "#4ade80" },
            { label: "Pendiente", value: formatCurrency(order.remainingAmount), color: remaining > 0 ? "#f97316" : undefined },
          ] as const).map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center", padding: "10px 8px", borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ha-text-3)", fontWeight: 600, marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: color ?? "var(--ha-text)", fontFamily: "ui-monospace,monospace" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Details grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px 24px" }}>
          <InfoRow label="Vendedor">{order.user?.name || "—"}</InfoRow>
          <InfoRow label="Lista de precios">{orderPriceListDisplayLabel(order.priceListType)}</InfoRow>
          <InfoRow label="Total calculado">{formatCurrency(order.totalPrice)}</InfoRow>
          <InfoRow label="Creada">{new Date(order.createdAt).toLocaleDateString("es-AR")}</InfoRow>
          <InfoRow label="Entrega programada">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—"}</InfoRow>
          <InfoRow label="Entregada">{order.isDelivered ? "Sí" : "No"}</InfoRow>
          <InfoRow label="Entregada el">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString("es-AR") : "—"}</InfoRow>
          <InfoRow label="Ubicación de stock">{order.fulfillmentLocation?.name ?? "—"}</InfoRow>
          {isCancelled && order.cancelledAt && (
            <InfoRow label="Cancelada el">
              <span style={{ color: "var(--ha-red)" }}>{new Date(order.cancelledAt).toLocaleDateString("es-AR")}</span>
            </InfoRow>
          )}
          {order.comment && (
            <div style={{ gridColumn: "1 / -1" }}>
              <InfoRow label="Comentario"><span style={{ whiteSpace: "pre-wrap" }}>{order.comment}</span></InfoRow>
            </div>
          )}
        </div>
      </div>

      {/* Items section with toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 12px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ha-text-3)", whiteSpace: "nowrap" }}>
          Ítems ({(order.orderItems ?? []).length})
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--ha-border)" }} />
        <button
          className="ha-iconbtn"
          style={{ width: 28, height: 28, flexShrink: 0 }}
          onClick={() => setItemsExpanded((v) => !v)}
          aria-label={itemsExpanded ? "Ocultar ítems" : "Mostrar ítems"}
        >
          <ChevronDown size={15} style={{ transform: itemsExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }} />
        </button>
      </div>
      {itemsExpanded && (
        <>
          {/* Desktop table */}
          <div className="ha-table-wrap" style={{ marginBottom: 4 }}>
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  {order.isConsignment && <th>Consignado</th>}
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(order.orderItems ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.product?.name ?? "—"}</td>
                    {order.isConsignment && <td>{item.originalQuantity != null ? formatQuantity(item.originalQuantity) : "—"}</td>}
                    <td>{formatQuantity(item.quantity)}</td>
                    <td>{item.price === null || item.price === undefined ? "—" : formatCurrency(item.price)}</td>
                    <td>{item.price === null || item.price === undefined ? "—" : formatCurrency(Number(item.price) * Number(item.quantity))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="ha-mobile-only" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
            {(order.orderItems ?? []).length === 0 ? (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)", color: "var(--ha-text-3)", fontSize: 14 }}>
                Sin ítems
              </div>
            ) : (order.orderItems ?? []).map((item) => (
              <div key={item.id} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)" }}>
                <div style={{ fontWeight: 600, color: "var(--ha-text)", fontSize: 14, marginBottom: 8 }}>{item.product?.name ?? "—"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", fontSize: 13 }}>
                  {order.isConsignment && (
                    <>
                      <span style={{ color: "var(--ha-text-3)" }}>Consignado</span>
                      <span style={{ color: "var(--ha-text)" }}>{item.originalQuantity != null ? formatQuantity(item.originalQuantity) : "—"}</span>
                    </>
                  )}
                  <span style={{ color: "var(--ha-text-3)" }}>Cantidad</span>
                  <span style={{ color: "var(--ha-text)" }}>{formatQuantity(item.quantity)}</span>
                  <span style={{ color: "var(--ha-text-3)" }}>Precio</span>
                  <span style={{ color: "var(--ha-text)" }}>{item.price == null ? "—" : formatCurrency(item.price)}</span>
                  <span style={{ color: "var(--ha-text-3)" }}>Subtotal</span>
                  <span style={{ color: "var(--ha-text)", fontWeight: 600 }}>{item.price == null ? "—" : formatCurrency(Number(item.price) * Number(item.quantity))}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionDivider label="Pagos" />

      {isPendingPricing ? (
        <div style={{ marginBottom: 4, padding: "14px 16px", borderRadius: 10, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)" }}>
          <p style={{ color: "var(--ha-text-3)", marginBottom: 12, fontSize: 14 }}>Esta orden está pendiente de cobro. Ingresá los precios del día para cada ítem y registrá el pago.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="ha-btn ha-btn--primary" onClick={() => void openCobrarModal()}>Cobrar consignación</button>
            <button className="ha-btn ha-btn--secondary" onClick={openDevolverModal}>Registrar devolución</button>
          </div>
        </div>
      ) : isCancelled ? (
        <div style={{ marginBottom: 4, padding: "14px 16px", borderRadius: 10, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)" }}>
          <p style={{ color: "var(--ha-text-3)", fontSize: 14 }}>Esta orden fue cancelada. No se pueden registrar pagos ni devoluciones.</p>
        </div>
      ) : (
        <div style={{ marginBottom: 4, padding: "14px 16px", borderRadius: 10, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="number"
              min={0.01}
              step={0.01}
              className="ha-input"
              style={{ width: 140 }}
              placeholder="Monto"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={isPaid}
            />
            <select
              className="ha-input"
              style={{ width: 200 }}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              disabled={isPaid}
            >
              <option value={PaymentMethod.CASH}>Efectivo</option>
              <option value={PaymentMethod.CARD}>Transferencia</option>
            </select>
            <button
              className="ha-btn ha-btn--primary"
              onClick={() => void handleAddPayment()}
              disabled={isPaid || !paymentAmount || Number(paymentAmount) <= 0 || addingPayment}
            >
              {addingPayment ? <><Spinner /> Registrando…</> : "Registrar pago"}
            </button>
          </div>
        </div>
      )}

      {/* Desktop payments table */}
      <div className="ha-table-wrap" style={{ marginBottom: 24 }}>
        <table className="ha-table">
          <thead>
            <tr>
              <th>Medio</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {(order.payments ?? []).length === 0 ? (
              <tr><td colSpan={2} style={{ color: "var(--ha-text-3)", textAlign: "center" }}>Sin pagos registrados</td></tr>
            ) : (order.payments ?? []).map((payment) => (
              <tr key={payment.id}>
                <td>
                  <select
                    className="ha-input"
                    style={{ minWidth: 180 }}
                    value={payment.method}
                    disabled={updatingPaymentId !== null}
                    onChange={(e) => void handleUpdatePaymentMethod(payment.id, e.target.value as PaymentMethod)}
                    aria-label="Medio de pago"
                  >
                    <option value={PaymentMethod.CASH}>Efectivo</option>
                    <option value={PaymentMethod.CARD}>Transferencia</option>
                  </select>
                  {updatingPaymentId === payment.id && <Spinner />}
                </td>
                <td>{formatCurrency(payment.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile payments cards */}
      <div className="ha-mobile-only" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {(order.payments ?? []).length === 0 ? (
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)", color: "var(--ha-text-3)", fontSize: 14 }}>
            Sin pagos registrados
          </div>
        ) : (order.payments ?? []).map((payment) => (
          <div key={payment.id} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <select
              className="ha-input"
              style={{ flex: "1 1 140px" }}
              value={payment.method}
              disabled={updatingPaymentId !== null}
              onChange={(e) => void handleUpdatePaymentMethod(payment.id, e.target.value as PaymentMethod)}
              aria-label="Medio de pago"
            >
              <option value={PaymentMethod.CASH}>Efectivo</option>
              <option value={PaymentMethod.CARD}>Transferencia</option>
            </select>
            {updatingPaymentId === payment.id && <Spinner />}
            <span style={{ fontWeight: 700, color: "var(--ha-text)", fontSize: 15, fontFamily: "ui-monospace,monospace" }}>{formatCurrency(payment.amount)}</span>
          </div>
        ))}
      </div>

      {/* Modal Cobrar consignación */}
      {cobrarModalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setCobrarModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 740 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Cobrar consignación</span>
              <button className="ha-iconbtn" onClick={() => setCobrarModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body" style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
              <p style={{ color: "var(--ha-text-3)", marginBottom: 16, fontSize: 14 }}>
                Precios pre-llenados con la lista activa ({(order.priceListType as string) ?? "mayorista"}). Podés editarlos antes de confirmar.
              </p>
              {cobrarPricesLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--ha-text-3)" }}>
                  <Spinner /> Cargando precios actuales…
                </div>
              )}
              <div className="ha-table-wrap" style={{ marginBottom: 16 }}>
                <table className="ha-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Disponible</th>
                      <th>Cant. vendida</th>
                      <th>Remanente</th>
                      <th>Precio unitario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrderItems.map((oi) => {
                      const ci = cobrarItems.find((c) => c.orderItemId === oi.id);
                      const cobrarQty = ci?.quantitySold ?? Number(oi.quantity);
                      const cobrarDisposition = ci?.unsoldDisposition ?? null;
                      const cobrarPrice = ci?.price ?? null;
                      const remaining = Number(oi.quantity) - cobrarQty;
                      return (
                        <tr key={oi.id}>
                          <td>{oi.product?.name ?? "—"}</td>
                          <td>{formatQuantity(oi.quantity)}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={Number(oi.quantity)}
                              step={1}
                              className="ha-input"
                              style={{ width: 80 }}
                              value={cobrarQty}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setCobrarItems((prev) => prev.map((i) =>
                                  i.orderItemId === oi.id
                                    ? { ...i, quantitySold: v, unsoldDisposition: v === Number(oi.quantity) ? null : i.unsoldDisposition }
                                    : i,
                                ));
                              }}
                            />
                          </td>
                          <td>
                            {remaining <= 0 ? (
                              <span style={{ color: "var(--ha-text-3)" }}>—</span>
                            ) : (
                              <select
                                className="ha-input"
                                style={{ width: 170 }}
                                value={cobrarDisposition ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value as "RETURN_TO_STOCK" | "KEEP_ON_CONSIGNMENT";
                                  setCobrarItems((prev) => prev.map((i) =>
                                    i.orderItemId === oi.id ? { ...i, unsoldDisposition: v } : i,
                                  ));
                                }}
                              >
                                <option value="">¿Qué hacemos?</option>
                                <option value="RETURN_TO_STOCK">Devolver al stock</option>
                                <option value="KEEP_ON_CONSIGNMENT">Dejar en consignación</option>
                              </select>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              className="ha-input"
                              style={{ width: 110 }}
                              placeholder="0.00"
                              value={cobrarPrice ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? null : Number(e.target.value);
                                setCobrarItems((prev) => prev.map((i) =>
                                  i.orderItemId === oi.id ? { ...i, price: v } : i,
                                ));
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginBottom: 16 }}>
                <strong style={{ color: "var(--ha-text)" }}>Total: {formatCurrency(cobrarTotal)}</strong>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="ha-input"
                  style={{ width: 160 }}
                  placeholder="Monto del pago"
                  value={cobrarPaymentAmount}
                  onChange={(e) => setCobrarPaymentAmount(e.target.value)}
                />
                <select
                  className="ha-input"
                  style={{ width: 180 }}
                  value={cobrarPaymentMethod}
                  onChange={(e) => setCobrarPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value={PaymentMethod.CASH}>Efectivo</option>
                  <option value={PaymentMethod.CARD}>Transferencia</option>
                </select>
              </div>
              <p style={{ color: "var(--ha-text-3)", marginTop: 8, fontSize: 12 }}>
                Dejá el monto en blanco si querés fijar los precios sin registrar el pago todavía.
              </p>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setCobrarModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" disabled={cobrarLoading} onClick={() => void handleCobrar()}>
                {cobrarLoading ? <><Spinner /> Confirmando…</> : "Confirmar cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar devolución */}
      {devolverModalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setDevolverModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Registrar devolución</span>
              <button className="ha-iconbtn" onClick={() => setDevolverModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <p style={{ color: "var(--ha-text-3)", marginBottom: 16, fontSize: 14 }}>
                Ingresá la cantidad que devuelve el cliente por cada ítem. El stock se reincorporará al inventario.
              </p>
              <div className="ha-table-wrap" style={{ marginBottom: 16 }}>
                <table className="ha-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>En consignación</th>
                      <th>Cant. a devolver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrderItems.map((oi) => {
                      const devolverQty = devolverItems.find((d) => d.orderItemId === oi.id)?.quantity ?? Number(oi.quantity);
                      return (
                        <tr key={oi.id}>
                          <td>{oi.product?.name ?? "—"}</td>
                          <td>{formatQuantity(oi.quantity)}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={Number(oi.quantity)}
                              step={1}
                              className="ha-input"
                              style={{ width: 100 }}
                              value={devolverQty}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setDevolverItems((prev) => prev.map((d) =>
                                  d.orderItemId === oi.id ? { ...d, quantity: v } : d,
                                ));
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDevolverModalOpen(false)}>Cancelar</button>
              <button
                className="ha-btn"
                style={{ background: "var(--ha-red)", color: "#fff", borderColor: "var(--ha-red)" }}
                disabled={devolverLoading}
                onClick={() => void handleDevolver()}
              >
                {devolverLoading ? <><Spinner /> Confirmando…</> : "Confirmar devolución"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
