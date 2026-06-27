"use client";

import { OrderCalculator } from "@/components/order-calculator/order-calculator";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import dayjs from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import type { PriceType } from "@/lib/order-calculator/price-types";
import {
  expandOrderLineDemands,
  fetchRecipesByProductIds,
  type RecipeIngredientRow,
} from "@/lib/order-calculator/stock-preview";
import { toast } from "@/lib/toast";
import { Spinner } from "@/components/spinner";
import type { CreateOrderRequest, Customer, Price, Product, StockLocation } from "@/lib/types";
import { fetchAllPages } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function OrderCalculatorPage() {
  return <OrderCalculatorPageContent />;
}

function OrderCalculatorPageContent() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calculatorKey, setCalculatorKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    items: { productId: string; quantity: number; price: number }[];
    total: number;
    customerId: string | null;
    priceListType: PriceType;
  } | null>(null);
  const [deliveryDate, setDeliveryDate] = useState(() => dayjs().startOf("day").format("YYYY-MM-DD"));
  const [submitting, setSubmitting] = useState(false);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState<string | null>(null);
  const [orderComment, setOrderComment] = useState("");
  const [balanceByProductId, setBalanceByProductId] = useState<Record<string, number>>({});
  const [recipesByProductId, setRecipesByProductId] = useState<Record<string, RecipeIngredientRow[]>>({});
  const [stockPreviewReady, setStockPreviewReady] = useState(false);
  const [isConsignment, setIsConsignment] = useState(false);

  const pricesByProductId = useMemo(() => {
    const map: Record<string, Price[]> = {};
    prices.forEach((price) => {
      if (!map[price.productId]) map[price.productId] = [];
      map[price.productId].push(price);
    });
    return map;
  }, [prices]);

  const productsGoingNegative = useMemo(() => {
    if (!pendingOrder || !fulfillmentLocationId || !stockPreviewReady) return [];
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const demand = expandOrderLineDemands(pendingOrder.items, recipesByProductId);
    const result: { name: string; current: number; requested: number; after: number }[] = [];
    for (const [productId, need] of Object.entries(demand)) {
      if (need <= 0) continue;
      const product = productById[productId];
      const atLocation = balanceByProductId[productId] ?? 0;
      const after = atLocation - need;
      if (after < 0) {
        result.push({ name: product?.name ?? productId, current: atLocation, requested: need, after });
      }
    }
    return result;
  }, [pendingOrder, products, fulfillmentLocationId, balanceByProductId, recipesByProductId, stockPreviewReady]);

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
        const [allProducts, allPrices, allCustomers, locs] = await Promise.all([
          fetchAllPages((page) => apiClient.getProducts(page, limit)),
          fetchAllPages((page) => apiClient.getPrices(page, limit, undefined, true)),
          fetchAllPages((page) => apiClient.getCustomers(page, limit)),
          apiClient.getStockLocations().catch(() => [] as StockLocation[]),
        ]);
        setProducts(allProducts);
        setPrices(allPrices);
        setCustomers(allCustomers);
        setStockLocations(locs);
        const def = locs.find((l) => l.isDefault)?.id ?? locs[0]?.id ?? null;
        setFulfillmentLocationId(def);
      } catch (e) {
        console.error(e);
        toast.error("Error al cargar productos y precios");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!confirmModalOpen) {
      setStockPreviewReady(false);
      setRecipesByProductId({});
      return;
    }
    if (!pendingOrder || !fulfillmentLocationId) return;
    let cancelled = false;
    setStockPreviewReady(false);
    void fetchProducts();
    void (async () => {
      try {
        const ids = [...new Set(pendingOrder.items.map((i) => i.productId))];
        const [rows, recipes] = await Promise.all([
          apiClient.getStockBalancesAtLocation(fulfillmentLocationId),
          fetchRecipesByProductIds((p, l, rid) => apiClient.getRecipeItems(p, l, rid), ids),
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
  }, [confirmModalOpen, pendingOrder, fulfillmentLocationId, fetchProducts]);

  const handleConfirmOrder = (
    items: { productId: string; quantity: number; price: number }[],
    total: number,
    customerId?: string | null,
    priceListType?: PriceType,
  ) => {
    setOrderComment("");
    setDeliveryDate(dayjs().startOf("day").format("YYYY-MM-DD"));
    setPendingOrder({ items, total, customerId: customerId ?? null, priceListType: priceListType ?? "mayorista" });
    setConfirmModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!pendingOrder) return;
    if (stockLocations.length > 0 && !fulfillmentLocationId) {
      toast.error("Elegí la ubicación de stock desde la cual descontar el pedido.");
      return;
    }
    const { items, total, customerId, priceListType } = pendingOrder;
    setSubmitting(true);
    try {
      const data: CreateOrderRequest = {
        customerId: customerId ?? undefined,
        userId: user?.id,
        deliveryDate: (deliveryDate ? dayjs(deliveryDate) : dayjs().startOf("day")).toISOString(),
        fulfillmentLocationId: fulfillmentLocationId ?? undefined,
        total: isConsignment ? 0 : total,
        priceListType,
        isConsignment: isConsignment || undefined,
        ...(orderComment.trim() ? { comment: orderComment.trim() } : {}),
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          price: isConsignment ? 0 : Number(item.price),
        })),
      };
      const createdOrder = await apiClient.createOrder(data);
      toast.success(`Orden creada (${createdOrder.paymentStatus}). El stock se descontó correctamente.`);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("order-calc-quantities");
          localStorage.removeItem("order-calc-customer-id");
          localStorage.removeItem("order-calc-price-type");
        } catch {}
      }
      setCalculatorKey((prev) => prev + 1);
      setConfirmModalOpen(false);
      setPendingOrder(null);
      setIsConsignment(false);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Error al crear la orden";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setConfirmModalOpen(false);
    setPendingOrder(null);
    setIsConsignment(false);
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <>
      <OrderCalculator
        key={calculatorKey}
        products={products}
        pricesByProductId={pricesByProductId}
        customers={customers}
        onConfirmOrder={handleConfirmOrder}
      />

      {confirmModalOpen && (
        <div className="ha-modal-backdrop" onClick={closeModal}>
          <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Confirmar pedido</span>
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
                  <div className="ha-field" style={{ marginBottom: 12 }}>
                    <label className="ha-label">Ubicación de stock (desde dónde se descuenta)</label>
                    <select className="ha-input" value={fulfillmentLocationId ?? ""} onChange={(e) => setFulfillmentLocationId(e.target.value || null)}>
                      <option value="">Elegí ubicación</option>
                      {stockLocations.map((l) => (
                        <option key={l.id} value={l.id}>{l.isDefault ? `${l.name} (predeterminada)` : l.name}</option>
                      ))}
                    </select>
                    {stockLocations.length === 0 && (
                      <p style={{ marginTop: 8, color: "#f87171", fontSize: 13 }}>
                        No hay ubicaciones cargadas. Ejecutá la migración de base y/o creá ubicaciones en Stock → Ubicaciones.
                      </p>
                    )}
                  </div>
                  {productsGoingNegative.length > 0 && (
                    <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.4)" }}>
                      <div style={{ color: "#fbbf24", fontWeight: 500, fontSize: 13, marginBottom: 6 }}>⚠ Stock insuficiente</div>
                      <p style={{ marginBottom: 8, color: "var(--ha-text-3)", fontSize: 13 }}>
                        En la ubicación elegida no alcanza el stock. Se descontará igual (puede quedar negativo). El total del producto en todas las ubicaciones sigue en la ficha.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ha-text-2)", fontSize: 13 }}>
                        {productsGoingNegative.map((p) => (
                          <li key={p.name}>
                            <strong>{p.name}</strong>: stock {p.current}, pedido {p.requested} → quedará {p.after}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="ha-field" style={{ marginBottom: 12 }}>
                    <label className="ha-label">Fecha de entrega</label>
                    <input type="date" className="ha-input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                  </div>
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
                  <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      id="consignment-check"
                      checked={isConsignment}
                      onChange={(e) => setIsConsignment(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "var(--ha-amber)", cursor: "pointer" }}
                    />
                    <label htmlFor="consignment-check" style={{ color: "var(--ha-text)", cursor: "pointer", fontSize: 14 }}>
                      Es consignación (el precio se fija al momento de cobrar)
                    </label>
                  </div>
                  {isConsignment && (
                    <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.35)" }}>
                      <div style={{ color: "#93c5fd", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>ℹ Orden a consignación</div>
                      <div style={{ color: "var(--ha-text-3)", fontSize: 13 }}>El stock se descuenta hoy. El precio se ingresa cuando vayas a cobrar esta orden.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeModal}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleCreateOrder()} disabled={submitting}>
                {submitting ? "Creando…" : "Crear orden y descontar stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
