"use client";

import { OrderCalculator } from "@/components/order-calculator/order-calculator";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import dayjs from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { inferPriceTypeFromOrderLines, parsePriceListType, type PriceType } from "@/lib/order-calculator/price-types";
import {
  expandOrderLineDemands,
  fetchRecipesByProductIds,
  type RecipeIngredientRow,
} from "@/lib/order-calculator/stock-preview";
import { toast } from "@/lib/toast";
import type { Customer, Order, Price, Product, StockLocation } from "@/lib/types";
import { fetchAllPages } from "@/lib/utils";
import { Spinner } from "@/components/spinner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";

interface OrderEditPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderEditPage({ params }: OrderEditPageProps) {
  const { id } = use(params);
  return <OrderEditPageContent id={id} />;
}

function OrderEditPageContent({ id }: { id: string }) {
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
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
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

  const inferredPriceType = useMemo(() => {
    if (!order?.orderItems?.length || !prices.length) return undefined;
    return inferPriceTypeFromOrderLines(
      order.orderItems.map((oi) => ({ ...oi, price: oi.price ?? 0 })),
      pricesByProductId,
    );
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
        result.push({ name: product?.name ?? productId, current: effective, requested: need, after });
      }
    }
    return result;
  }, [pendingOrder, products, order, fulfillmentLocationId, balanceByProductId, recipesByProductId, stockPreviewReady]);

  const limit = 100;

  const fetchProducts = useCallback(async () => {
    const allProducts = await fetchAllPages((page) => apiClient.getProducts(page, limit));
    setProducts(allProducts);
    return allProducts;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [orderData, allProducts, allPrices, allCustomers, locs] = await Promise.all([
          apiClient.getOrder(id),
          fetchAllPages((page) => apiClient.getProducts(page, limit)),
          fetchAllPages((page) => apiClient.getPrices(page, limit, undefined, true)),
          fetchAllPages((page) => apiClient.getCustomers(page, limit)),
          apiClient.getStockLocations().catch(() => [] as StockLocation[]),
        ]);
        setOrder(orderData);
        setDeliveryDate(orderData.deliveryDate ? orderData.deliveryDate.slice(0, 10) : "");
        setDeliveredAt(orderData.deliveredAt ? new Date(orderData.deliveredAt).toISOString().slice(0, 16) : "");
        setOrderComment(orderData.comment ?? "");
        setProducts(allProducts);
        setPrices(allPrices);
        setCustomers(allCustomers);
        setStockLocations(locs);
        const fromOrder = orderData.fulfillmentLocationId;
        const def = fromOrder ?? locs.find((l) => l.isDefault)?.id ?? locs[0]?.id ?? null;
        setFulfillmentLocationId(def);
      } catch (e) {
        console.error(e);
        toast.error("Error al cargar la orden o los datos");
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!confirmModalOpen) {
      setStockPreviewReady(false);
      setRecipesByProductId({});
      return;
    }
    if (!pendingOrder || !fulfillmentLocationId || !order?.orderItems) return;
    let cancelled = false;
    setStockPreviewReady(false);
    void fetchProducts();
    void (async () => {
      try {
        const ids = new Set<string>();
        pendingOrder.items.forEach((i) => ids.add(i.productId));
        order.orderItems!.forEach((oi) => ids.add(oi.productId));
        const [rows, recipes] = await Promise.all([
          apiClient.getStockBalancesAtLocation(fulfillmentLocationId),
          fetchRecipesByProductIds((p, l, rid) => apiClient.getRecipeItems(p, l, rid), [...ids]),
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
    return () => { cancelled = true; };
  }, [confirmModalOpen, pendingOrder, fulfillmentLocationId, fetchProducts, order?.orderItems]);

  const handleConfirmOrder = (
    items: { productId: string; quantity: number; price: number }[],
    total: number,
    customerId?: string | null,
    priceListType?: PriceType,
  ) => {
    setPendingOrder({ items, total, customerId: customerId ?? null, priceListType: priceListType ?? inferredPriceType ?? "mayorista" });
    setConfirmModalOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!pendingOrder || !order) return;
    if (stockLocations.length > 0 && !fulfillmentLocationId) {
      toast.error("Elegí la ubicación de stock desde la cual descontar el pedido.");
      return;
    }
    const { items, total, customerId, priceListType } = pendingOrder;
    setSubmitting(true);
    try {
      await apiClient.updateOrder(id, {
        customerId: customerId ?? undefined,
        userId: order.userId ?? user?.id ?? undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : (order.deliveryDate ? new Date(order.deliveryDate).toISOString() : undefined),
        deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : null,
        fulfillmentLocationId: fulfillmentLocationId ?? undefined,
        total,
        priceListType,
        comment: orderComment,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
      });
      toast.success("Orden actualizada. El stock se ajustó correctamente.");
      setConfirmModalOpen(false);
      setPendingOrder(null);
      const updated = await apiClient.getOrder(id);
      setOrder(updated);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Error al actualizar la orden";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setConfirmModalOpen(false);
    setPendingOrder(null);
  };

  if (loading) {
    return <Spinner />;
  }

  if (!order) {
    return (
      <div>
        <Link href="/orders" className="ha-btn ha-btn--secondary ha-btn--sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 16 }}>
          <ArrowLeft size={15} /> Volver al listado
        </Link>
        <p style={{ color: "var(--ha-text-3)" }}>No se pudo cargar la orden.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/orders" className="ha-btn ha-btn--secondary ha-btn--sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <ArrowLeft size={15} /> Volver al listado
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

      {confirmModalOpen && (
        <div className="ha-modal-backdrop" onClick={closeModal}>
          <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Confirmar cambios</span>
              <button className="ha-iconbtn" onClick={closeModal} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              {pendingOrder && (
                <div>
                  <p style={{ marginBottom: 8, color: "var(--ha-text-3)" }}>Total: {formatCurrency(pendingOrder.total)}</p>
                  <p style={{ marginBottom: 8, color: "var(--ha-text-3)" }}>Ítems: {pendingOrder.items.length}</p>
                  {pendingOrder.customerId && (
                    <p style={{ marginBottom: 8, color: "var(--ha-text-3)" }}>
                      Cliente: {customers.find((c) => c.id === pendingOrder.customerId)?.name ?? pendingOrder.customerId}
                    </p>
                  )}
                  {stockLocations.length > 0 && (
                    <div className="ha-field" style={{ marginBottom: 12 }}>
                      <label className="ha-label">Ubicación de stock (desde dónde se descuenta)</label>
                      <select className="ha-input" value={fulfillmentLocationId ?? ""} onChange={(e) => setFulfillmentLocationId(e.target.value || null)}>
                        <option value="">Elegí ubicación</option>
                        {stockLocations.map((l) => (
                          <option key={l.id} value={l.id}>{l.isDefault ? `${l.name} (predeterminada)` : l.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="ha-field" style={{ marginBottom: 12 }}>
                    <label className="ha-label">Fecha de entrega</label>
                    <input type="date" className="ha-input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                  </div>
                  <div className="ha-field" style={{ marginBottom: 12 }}>
                    <label className="ha-label">Entregado en (real)</label>
                    <input type="datetime-local" className="ha-input" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
                  </div>
                  {productsGoingNegative.length > 0 && (
                    <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.4)" }}>
                      <div style={{ color: "#fbbf24", fontWeight: 500, fontSize: 13, marginBottom: 6 }}>⚠ Stock insuficiente</div>
                      <p style={{ marginBottom: 8, color: "var(--ha-text-3)", fontSize: 13 }}>
                        Tras devolver el stock de esta orden, los productos indicados quedarían por debajo de cero. Se aplicará igual.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ha-text-2)", fontSize: 13 }}>
                        {productsGoingNegative.map((p) => (
                          <li key={p.name}>
                            <strong>{p.name}</strong>: disponible {p.current}, pedido {p.requested} → quedará {p.after}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="ha-field" style={{ marginTop: 12, marginBottom: 16 }}>
                    <label className="ha-label">Comentario del pedido (opcional)</label>
                    <textarea
                      className="ha-input"
                      value={orderComment}
                      onChange={(e) => setOrderComment(e.target.value)}
                      placeholder="Ej. horario de retiro, instrucciones especiales…"
                      rows={3}
                      maxLength={2000}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeModal}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSaveOrder()} disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar orden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
