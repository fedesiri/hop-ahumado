"use client";

import { OrderDetailView } from "@/components/orders/order-detail-view";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { buildOrderClipboardText } from "@/lib/order-clipboard";
import { formatPaymentMethodsOnly, orderPaymentStatusLabel } from "@/lib/order-labels";
import { toast } from "@/lib/toast";
import { OrderPaymentStatus, type Order, type OrderItem, type User } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Paginator } from "@/components/paginator";
import { Spinner } from "@/components/spinner";
import { Copy, Edit2, ExternalLink, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PAYMENT_STATUS_OPTIONS = [
  { value: OrderPaymentStatus.UNPAID, label: orderPaymentStatusLabel(OrderPaymentStatus.UNPAID) },
  { value: OrderPaymentStatus.PARTIALLY_PAID, label: orderPaymentStatusLabel(OrderPaymentStatus.PARTIALLY_PAID) },
  { value: OrderPaymentStatus.PAID, label: orderPaymentStatusLabel(OrderPaymentStatus.PAID) },
  { value: OrderPaymentStatus.PENDING_PRICING, label: orderPaymentStatusLabel(OrderPaymentStatus.PENDING_PRICING) },
  { value: OrderPaymentStatus.CANCELLED, label: orderPaymentStatusLabel(OrderPaymentStatus.CANCELLED) },
];

export default function OrdersPage() {
  return <OrdersContent />;
}

function OrdersContent() {
  const { selectedLineId } = useLineContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerFilterOptions, setCustomerFilterOptions] = useState<{ label: string; value: string }[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [togglingDeliveryId, setTogglingDeliveryId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  const [filterCustomerId, setFilterCustomerId] = useState<string | undefined>(
    () => searchParams.get("customerId") ?? undefined,
  );
  const [filterUserId, setFilterUserId] = useState<string | undefined>(
    () => searchParams.get("userId") ?? undefined,
  );
  const [filterDateFrom, setFilterDateFrom] = useState<string>(
    () => searchParams.get("dateFrom") ?? "",
  );
  const [filterDateTo, setFilterDateTo] = useState<string>(
    () => searchParams.get("dateTo") ?? "",
  );
  const [filterMinTotal, setFilterMinTotal] = useState<string>(
    () => searchParams.get("minTotal") ?? "",
  );
  const [filterMaxTotal, setFilterMaxTotal] = useState<string>(
    () => searchParams.get("maxTotal") ?? "",
  );
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<OrderPaymentStatus | "">(
    () => (searchParams.get("paymentStatus") as OrderPaymentStatus) ?? "",
  );
  const [filterDelivered, setFilterDelivered] = useState<"true" | "false" | "">(
    () => (searchParams.get("delivered") as "true" | "false") ?? "",
  );
  const customerSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const loadCustomerFilterOptions = async (search: string) => {
    try {
      const trimmed = search.trim();
      const res = await apiClient.getCustomers(1, 50, trimmed || undefined);
      setCustomerFilterOptions(res.data.map((c) => ({ label: c.name, value: c.id })));
    } catch {
      toast.error("Error al buscar clientes");
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, [
    pagination.page, pagination.limit,
    filterCustomerId, filterUserId,
    filterDateFrom, filterDateTo,
    filterMinTotal, filterMaxTotal,
    filterPaymentStatus, filterDelivered,
    selectedLineId,
  ]);

  useEffect(() => {
    return () => {
      if (customerSearchTimerRef.current) clearTimeout(customerSearchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const usersRes = await apiClient.getUsers(1, 100);
        setUsers(usersRes.data);
      } catch {
        // silent
      }
    })();
  }, []);

  useEffect(() => {
    void loadCustomerFilterOptions("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filterCustomerId) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await apiClient.getCustomer(filterCustomerId);
        if (cancelled) return;
        setCustomerFilterOptions((prev) =>
          prev.some((o) => o.value === c.id) ? prev : [{ label: c.name, value: c.id }, ...prev],
        );
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [filterCustomerId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const dateFrom = filterDateFrom ? new Date(filterDateFrom + "T00:00:00").toISOString() : undefined;
      const dateTo = filterDateTo ? new Date(filterDateTo + "T23:59:59").toISOString() : undefined;
      const response = await apiClient.getOrders(
        pagination.page, pagination.limit,
        filterCustomerId, filterUserId,
        dateFrom, dateTo,
        filterMinTotal ? Number(filterMinTotal) : undefined,
        filterMaxTotal ? Number(filterMaxTotal) : undefined,
        filterPaymentStatus || undefined,
        (filterDelivered as "true" | "false") || undefined,
        selectedLineId ?? undefined,
      );
      setOrders(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar órdenes");
    } finally {
      setLoading(false);
    }
  };

  const openViewModal = async (orderId: string) => {
    setViewModalOpen(true);
    setModalOrder(null);
    setModalLoading(true);
    try {
      const data = await apiClient.getOrder(orderId);
      setModalOrder(data);
    } catch {
      toast.error("No se pudo cargar el detalle de la orden");
      setViewModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleDelivered = async (record: Order) => {
    const nextDelivered = !record.isDelivered;
    setTogglingDeliveryId(record.id);
    try {
      const updated = await apiClient.updateOrder(record.id, {
        deliveredAt: nextDelivered ? new Date().toISOString() : null,
      });
      setOrders((prev) => prev.map((o) => (o.id === record.id ? updated : o)));
      setModalOrder((m) => (m?.id === record.id ? updated : m));
      toast.success(nextDelivered ? "Orden marcada como entregada" : "Entrega desmarcada");
    } catch {
      toast.error("No se pudo actualizar el estado de entrega");
    } finally {
      setTogglingDeliveryId(null);
    }
  };

  const handleCopyOrder = async (record: Order) => {
    const text = buildOrderClipboardText(record);
    if (!text) { toast.warning("Esta orden no tiene ítems para copiar"); return; }
    try {
      await navigator.clipboard.writeText(text);
      if (navigator.vibrate) navigator.vibrate(30);
      toast.success("Pedido copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteOrder(id);
      toast.success("Orden eliminada");
      setDeleteId(null);
      fetchOrders();
    } catch {
      toast.error("Error al eliminar orden");
      setDeleteId(null);
    }
  };

  const paymentStatusBadge = (status: OrderPaymentStatus) => {
    const cls =
      status === OrderPaymentStatus.PAID ? "ha-badge--paid" :
      status === OrderPaymentStatus.PARTIALLY_PAID ? "ha-badge--pending" :
      status === OrderPaymentStatus.PENDING_PRICING ? "ha-badge--warning" :
      status === OrderPaymentStatus.CANCELLED ? "ha-badge--draft" : "ha-badge--draft";
    return <span className={`ha-badge ${cls}`}>{orderPaymentStatusLabel(status)}</span>;
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Órdenes</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/orders/calculator">
            <button className="ha-btn ha-btn--primary ha-btn--sm">+ Nueva orden</button>
          </Link>
          <Link href="/orders/metrics">
            <button className="ha-btn ha-btn--secondary ha-btn--sm">Métricas</button>
          </Link>
        </div>
      </div>

      <ScreenInfoPanel title="Dónde están los productos al armar un pedido">
        <>
          Los ítems salen del catálogo en <strong>Productos</strong>. Para que aparezcan con precio en la calculadora,
          cargá al menos un <strong>Precio</strong> activo para cada producto. Luego abrí{" "}
          <Link href="/orders/calculator">Nueva orden</Link>: elegís cliente, buscás el producto (ej. panes) y la
          cantidad. Al confirmar, el sistema <strong>descuenta solo el stock del producto vendido</strong> (el pan), no
          los ingredientes de la receta.
        </>
      </ScreenInfoPanel>

      {/* Filters */}
      <div style={{ background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: "1 1 200px", minWidth: 160 }}>
            <input
              className="ha-input"
              style={{ height: 36 }}
              placeholder="Buscar cliente…"
              list="customer-options"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                if (customerSearchTimerRef.current) clearTimeout(customerSearchTimerRef.current);
                customerSearchTimerRef.current = setTimeout(() => void loadCustomerFilterOptions(e.target.value), 300);
              }}
              onBlur={() => {
                const match = customerFilterOptions.find((o) =>
                  o.label.toLowerCase() === customerSearch.toLowerCase()
                );
                if (match) {
                  setFilterCustomerId(match.value);
                  setCustomerSearch(match.label);
                  updateParams({ customerId: match.value });
                } else if (!customerSearch) {
                  setFilterCustomerId(undefined);
                  updateParams({ customerId: null });
                }
              }}
            />
            <datalist id="customer-options">
              {customerFilterOptions.map((o) => <option key={o.value} value={o.label} />)}
            </datalist>
          </div>

          <select
            className="ha-select"
            style={{ height: 36, padding: "0 12px", flex: "1 1 160px", minWidth: 140, borderRadius: 8, border: "1px solid var(--ha-border-2)", background: "var(--ha-bg-raised)", color: "var(--ha-text)", fontSize: 13 }}
            value={filterUserId ?? ""}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setFilterUserId(e.target.value || undefined);
              updateParams({ userId: e.target.value || null });
            }}
          >
            <option value="">Todos los vendedores</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <input
            type="date"
            className="ha-input"
            style={{ height: 36, flex: "1 1 130px", minWidth: 120 }}
            value={filterDateFrom}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setFilterDateFrom(e.target.value);
              updateParams({ dateFrom: e.target.value || null });
            }}
          />
          <input
            type="date"
            className="ha-input"
            style={{ height: 36, flex: "1 1 130px", minWidth: 120 }}
            value={filterDateTo}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setFilterDateTo(e.target.value);
              updateParams({ dateTo: e.target.value || null });
            }}
          />

          <input
            type="number"
            className="ha-input"
            style={{ height: 36, flex: "1 1 110px", minWidth: 100 }}
            placeholder="Total mín."
            value={filterMinTotal}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setFilterMinTotal(e.target.value);
              updateParams({ minTotal: e.target.value || null });
            }}
          />
          <input
            type="number"
            className="ha-input"
            style={{ height: 36, flex: "1 1 110px", minWidth: 100 }}
            placeholder="Total máx."
            value={filterMaxTotal}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setFilterMaxTotal(e.target.value);
              updateParams({ maxTotal: e.target.value || null });
            }}
          />

          <select
            className="ha-select"
            style={{ height: 36, padding: "0 12px", flex: "1 1 160px", minWidth: 140, borderRadius: 8, border: "1px solid var(--ha-border-2)", background: "var(--ha-bg-raised)", color: "var(--ha-text)", fontSize: 13 }}
            value={filterPaymentStatus}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setFilterPaymentStatus(e.target.value as OrderPaymentStatus | "");
              updateParams({ paymentStatus: e.target.value || null });
            }}
          >
            <option value="">Estado de pago</option>
            {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            className="ha-select"
            style={{ height: 36, padding: "0 12px", flex: "1 1 130px", minWidth: 120, borderRadius: 8, border: "1px solid var(--ha-border-2)", background: "var(--ha-bg-raised)", color: "var(--ha-text)", fontSize: 13 }}
            value={filterDelivered}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setFilterDelivered(e.target.value as "true" | "false" | "");
              updateParams({ delivered: e.target.value || null });
            }}
          >
            <option value="">Entrega</option>
            <option value="true">Entregadas</option>
            <option value="false">No entregadas</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState title="Sin órdenes" subtitle="No hay órdenes que coincidan con los filtros." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="ha-table-wrap" style={{ overflowX: "auto" }}>
            <table className="ha-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>Cliente</th>
                  <th className="ha-th--right" style={{ minWidth: 90 }}>Total</th>
                  <th style={{ minWidth: 110 }}>Estado pago</th>
                  <th style={{ minWidth: 100 }}>Medios de pago</th>
                  <th className="ha-th--right" style={{ minWidth: 90 }}>Pagado</th>
                  <th className="ha-th--right" style={{ minWidth: 90 }}>Pendiente</th>
                  <th style={{ minWidth: 80 }}>Ítems</th>
                  <th style={{ minWidth: 90 }}>Programada</th>
                  <th style={{ minWidth: 90 }}>Entregada</th>
                  <th style={{ minWidth: 80 }}>Stock desde</th>
                  <th style={{ minWidth: 150, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 500 }}>{order.customer?.name?.trim() || "Sin cliente"}</td>
                    <td className="ha-td--right ha-mono">{formatCurrency(order.total ?? order.totalPrice ?? 0)}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {paymentStatusBadge(order.paymentStatus)}
                        {order.isConsignment && <span className="ha-badge ha-badge--purple">Consignación</span>}
                      </div>
                    </td>
                    <td style={{ color: "var(--ha-text-2)", fontSize: 12 }}>{formatPaymentMethodsOnly(order.payments)}</td>
                    <td className="ha-td--right ha-mono">{formatCurrency(order.paidAmount ?? 0)}</td>
                    <td className="ha-td--right ha-mono">{formatCurrency(order.remainingAmount ?? 0)}</td>
                    <td className="ha-mono">{(order.orderItems as OrderItem[] | undefined)?.length || 0}</td>
                    <td className="ha-mono" style={{ color: "var(--ha-text-2)" }}>
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td>
                      <button
                        style={{
                          width: 36, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                          background: order.isDelivered ? "var(--ha-green)" : "var(--ha-border-2)",
                          transition: "background .2s", position: "relative",
                          opacity: togglingDeliveryId === order.id ? 0.6 : 1,
                        }}
                        onClick={() => void handleToggleDelivered(order)}
                        disabled={togglingDeliveryId === order.id}
                        aria-label={order.isDelivered ? "Desmarcar entregada" : "Marcar entregada"}
                      >
                        <span style={{
                          position: "absolute", top: 3, left: order.isDelivered ? 17 : 3,
                          width: 16, height: 16, borderRadius: "50%", background: "#fff",
                          transition: "left .2s",
                        }} />
                      </button>
                    </td>
                    <td style={{ color: "var(--ha-text-2)", fontSize: 12 }}>{order.fulfillmentLocation?.name ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 5 }}>
                        <button
                          onClick={() => void openViewModal(order.id)}
                          style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                          title="Ver detalle"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => void handleCopyOrder(order)}
                          style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                          title="Copiar pedido"
                        >
                          <Copy size={13} />
                        </button>
                        <Link
                          href={`/orders/${order.id}/edit`}
                          style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--ha-amber)", background: "var(--ha-amber-soft)", borderRadius: 7, color: "var(--ha-amber)" }}
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </Link>
                        <button
                          onClick={() => setDeleteId(order.id)}
                          style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 7, color: "var(--ha-red)", cursor: "pointer" }}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="ha-cardlist">
            {orders.map((order) => (
              <div key={order.id} className="ha-ordcard">
                <div className="ha-ordcard__top">
                  <span className="ha-ordcard__name">{order.customer?.name?.trim() || "Sin cliente"}</span>
                  {paymentStatusBadge(order.paymentStatus)}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 13, marginTop: 6, flexWrap: "wrap" }}>
                  <span className="ha-mono" style={{ color: "var(--ha-text)" }}>{formatCurrency(order.total ?? order.totalPrice ?? 0)}</span>
                  {order.deliveryDate && <span style={{ color: "var(--ha-text-3)" }}>Entrega: {new Date(order.deliveryDate).toLocaleDateString("es-AR")}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <button
                    style={{
                      width: 36, height: 22, borderRadius: 11, border: "none", cursor: "pointer", flexShrink: 0,
                      background: order.isDelivered ? "var(--ha-green)" : "var(--ha-border-2)",
                      transition: "background .2s", position: "relative",
                      opacity: togglingDeliveryId === order.id ? 0.6 : 1,
                    }}
                    onClick={() => void handleToggleDelivered(order)}
                    disabled={togglingDeliveryId === order.id}
                    aria-label={order.isDelivered ? "Desmarcar entregada" : "Marcar entregada"}
                  >
                    <span style={{
                      position: "absolute", top: 3, left: order.isDelivered ? 17 : 3,
                      width: 16, height: 16, borderRadius: "50%", background: "#fff",
                      transition: "left .2s",
                    }} />
                  </button>
                  <span style={{ fontSize: 12, color: order.isDelivered ? "var(--ha-green)" : "var(--ha-text-3)" }}>
                    {order.isDelivered ? "Entregada" : "No entregada"}
                  </span>
                </div>
                <div className="ha-ordcard__actions">
                  <button onClick={() => void openViewModal(order.id)} className="ha-actbtn" title="Ver"><Eye size={15} /></button>
                  <button onClick={() => void handleCopyOrder(order)} className="ha-actbtn" title="Copiar"><Copy size={15} /></button>
                  <Link href={`/orders/${order.id}/edit`} className="ha-actbtn" title="Editar" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}><Edit2 size={15} /></Link>
                  <button onClick={() => setDeleteId(order.id)} className="ha-actbtn" title="Eliminar" style={{ borderColor: "var(--ha-red)", color: "var(--ha-red)" }}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && (
            <Paginator
              page={pagination.page}
              totalPages={Math.ceil(meta.total / pagination.limit)}
              total={meta.total}
              label="órdenes"
              onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
            />
          )}
        </>
      )}

      {/* View modal */}
      {viewModalOpen && (
        <div className="ha-modal-backdrop" onClick={() => { setViewModalOpen(false); setModalOrder(null); }}>
          <div className="ha-modal" style={{ maxWidth: "min(1100px, calc(100vw - 32px))", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Detalle de la orden</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {modalOrder && (
                  <Link href={`/orders/${modalOrder.id}`} className="ha-iconbtn" title="Abrir en página completa" aria-label="Abrir en página completa">
                    <ExternalLink size={17} />
                  </Link>
                )}
                <button className="ha-iconbtn" onClick={() => { setViewModalOpen(false); setModalOrder(null); }} aria-label="Cerrar">✕</button>
              </div>
            </div>
            <div className="ha-modal__body app-panel-scroll">
              {modalLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
                </div>
              ) : modalOrder ? (
                <OrderDetailView
                  key={modalOrder.id}
                  order={modalOrder}
                  onOrderUpdated={(o) => {
                    setModalOrder(o);
                    setOrders((prev) => prev.map((row) => (row.id === o.id ? o : row)));
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <ConfirmDialog
          title="¿Eliminar orden?"
          description="Esta acción no puede deshacerse."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void handleDelete(deleteId)}
        />
      )}
    </div>
  );
}
