"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import { OrderPaymentStatus, type DashboardCash, type DashboardLowStockProduct, type DashboardPendingDelivery, type TreasuryBaseline } from "@/lib/types";
import { ChevronDown, Eye, RefreshCw, ShoppingCart, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ZERO_CASH: DashboardCash = { deltaCashIn: 0, deltaCashOut: 0, deltaCardIn: 0, deltaCardOut: 0, balanceCash: 0, balanceCard: 0, total: 0 };

export function Dashboard() {
  const { selectedLineId } = useLineContext();
  const lowStockSectionRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [baseline, setBaseline] = useState<TreasuryBaseline | null>(null);
  const [cash, setCash] = useState<DashboardCash>(ZERO_CASH);
  const [stats, setStats] = useState({
    totalOrders: 0,
    lowStockProducts: [] as DashboardLowStockProduct[],
    recentOrders: [] as DashboardPendingDelivery[],
    totalCustomers: 0,
  });
  const [cashFlowModalOpen, setCashFlowModalOpen] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [formCash, setFormCash] = useState("");
  const [formCard, setFormCard] = useState("");
  const [formSince, setFormSince] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setApiConnected(null);

      const data = await apiClient.getDashboard(
        selectedLineId ?? undefined,
        startOfLocalDay(new Date()).toISOString(),
      );

      setApiConnected(true);
      if (data.baseline) setBaseline(data.baseline);
      if (data.cash) setCash(data.cash);
      setStats({
        totalOrders: data.totalOrders,
        lowStockProducts: data.lowStockProducts,
        recentOrders: data.pendingDeliveries,
        totalCustomers: data.totalCustomers,
      });
    } catch {
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLineId]);

  useEffect(() => {
    if (cashFlowModalOpen && baseline) {
      setFormCash(String(baseline.openingCash));
      setFormCard(String(baseline.openingCard));
      setFormSince(toDatetimeLocal(baseline.deltaSince));
      setFormErrors({});
    }
  }, [cashFlowModalOpen, baseline]);

  const saveBaseline = async () => {
    if (!selectedLineId) {
      toast.error("Seleccioná una línea de negocio");
      return;
    }
    const errors: Record<string, string> = {};
    if (!formCash) errors.cash = "Requerido";
    if (!formCard) errors.card = "Requerido";
    if (!formSince) errors.since = "Requerido";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    try {
      setSavingBaseline(true);
      await apiClient.updateTreasuryBaseline({
        businessLineId: selectedLineId,
        openingCash: Number(formCash),
        openingCard: Number(formCard),
        deltaSince: new Date(formSince).toISOString(),
      });
      toast.success("Saldos guardados");
      setCashFlowModalOpen(false);
      fetchDashboardData();
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSavingBaseline(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px 0" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          border: "2px solid var(--ha-border-2)",
          borderTopColor: "var(--ha-amber)",
          animation: "ha-spin .7s linear infinite",
        }} />
      </div>
    );
  }

  if (apiConnected === false) {
    return (
      <div style={{ background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ha-text)", margin: "0 0 8px" }}>API no conectada</p>
        <p style={{ fontSize: 13, color: "var(--ha-text-3)", margin: "0 0 20px" }}>
          No se pudo conectar al backend en{" "}
          <code style={{ color: "var(--ha-amber)", background: "var(--ha-bg-raised)", padding: "2px 6px", borderRadius: 4 }}>
            {process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}
          </code>
        </p>
        <button className="ha-btn ha-btn--primary" onClick={fetchDashboardData}>
          <RefreshCw size={15} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Inicio</h1>
        <button className="ha-btn ha-btn--secondary ha-btn--sm" onClick={fetchDashboardData}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      <div className="ha-stats" style={{ marginBottom: 20 }}>
        <div className="ha-stat">
          <div className="ha-stat__l">Total órdenes</div>
          <div className="ha-stat__v ha-mono">{stats.totalOrders}</div>
        </div>
        <div
          className="ha-stat"
          style={{ cursor: "pointer" }}
          onClick={() => setCashFlowModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCashFlowModalOpen(true); }}
        >
          <div className="ha-stat__l">Caja disponible</div>
          <div className="ha-stat__v ha-mono">{formatCurrency(cash.total)}</div>
          {baseline && (
            <div className="ha-stat__s">
              Desde {new Date(baseline.deltaSince).toLocaleDateString("es-AR")}
            </div>
          )}
        </div>
        <div
          className="ha-stat"
          style={{ cursor: "pointer" }}
          onClick={() => lowStockSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          role="button"
          tabIndex={0}
        >
          <div className="ha-stat__l">Stock bajo</div>
          <div className="ha-stat__v ha-mono" style={{ color: "var(--ha-orange)" }}>
            {stats.lowStockProducts.length}
          </div>
          <div className="ha-stat__s">Menos de 12 unidades</div>
        </div>
        <div className="ha-stat">
          <div className="ha-stat__l">Clientes activos</div>
          <div className="ha-stat__v ha-mono">{stats.totalCustomers}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
        {/* Pending deliveries */}
        <div style={{ background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Entregas pendientes</span>
            {stats.recentOrders.length > 0 && (
              <span style={{ background: "var(--ha-amber-soft)", color: "var(--ha-amber)", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999 }}>
                {stats.recentOrders.length} pendientes
              </span>
            )}
          </div>

          {stats.recentOrders.length === 0 ? (
            <div className="ha-empty">
              <ShoppingCart size={32} className="ha-empty__icon" />
              <p className="ha-empty__t">Sin entregas pendientes</p>
              <p className="ha-empty__s">No hay órdenes con fecha de entrega hoy o posterior sin entregar o impagas</p>
            </div>
          ) : (
            <>
              <div className="ha-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="ha-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="ha-th--right">Total</th>
                      <th>Estado pago</th>
                      <th>Entrega</th>
                      <th style={{ width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 500 }}>
                          {order.customer?.name ?? "Sin asignar"}
                        </td>
                        <td className="ha-td--right ha-mono">{formatCurrency(order.total)}</td>
                        <td>
                          <span className={`ha-badge ${order.paymentStatus === "PAID" ? "ha-badge--paid" : order.paymentStatus === "PARTIALLY_PAID" ? "ha-badge--pending" : "ha-badge--draft"}`}>
                            {order.paymentStatus === "PAID" ? "Pagado" : order.paymentStatus === "PARTIALLY_PAID" ? "Parcial" : "Pendiente"}
                          </span>
                        </td>
                        <td className="ha-mono" style={{ color: "var(--ha-text-2)" }}>
                          {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—"}
                        </td>
                        <td>
                          <Link href={`/orders/${order.id}`} style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 7, border: "1px solid var(--ha-border-2)", color: "var(--ha-text-2)" }}>
                            <Eye size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ha-cardlist" style={{ padding: 12, gap: 0 }}>
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="ha-ordcard" style={{ border: "none", borderBottom: "1px solid var(--ha-border)", borderRadius: 0, padding: "12px 4px" }}>
                    <div className="ha-ordcard__top">
                      <span className="ha-ordcard__name">
                        {order.customer?.name ?? "Sin asignar"}
                      </span>
                      <span className={`ha-badge ${order.paymentStatus === "PAID" ? "ha-badge--paid" : order.paymentStatus === "PARTIALLY_PAID" ? "ha-badge--pending" : "ha-badge--draft"}`}>
                        {order.paymentStatus === "PAID" ? "Pagado" : order.paymentStatus === "PARTIALLY_PAID" ? "Parcial" : "Pendiente"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ha-text-3)" }}>
                      <span className="ha-mono" style={{ color: "var(--ha-text-2)" }}>{formatCurrency(order.total)}</span>
                      <span>·</span>
                      <span className="ha-mono">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ padding: "12px 20px", textAlign: "right", borderTop: "1px solid var(--ha-border)" }}>
            <Link href="/orders" style={{ color: "var(--ha-amber)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              Ver todas las órdenes →
            </Link>
          </div>
        </div>

        {/* Low stock */}
        <div
          id="dashboard-low-stock"
          ref={lowStockSectionRef}
          style={{ scrollMarginTop: 72, background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", borderRadius: 12, overflow: "hidden" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Alertas de stock</span>
            {stats.lowStockProducts.length > 0 && (
              <span style={{ background: "var(--ha-amber-soft)", color: "var(--ha-amber)", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999 }}>
                {stats.lowStockProducts.length} ítems
              </span>
            )}
          </div>

          {stats.lowStockProducts.length === 0 ? (
            <div className="ha-empty">
              <TriangleAlert size={32} className="ha-empty__icon" />
              <p className="ha-empty__t">Stock suficiente</p>
              <p className="ha-empty__s">Todos los productos tienen stock suficiente</p>
            </div>
          ) : (
            <>
              <div className="ha-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="ha-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Stock</th>
                      <th>Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.lowStockProducts.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td>
                          <span style={{
                            display: "inline-grid", placeItems: "center", minWidth: 36, height: 24,
                            padding: "0 8px", borderRadius: 7, fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13,
                            background: Number(p.stock) < 5 ? "var(--ha-red-soft)" : "rgba(251,146,60,0.16)",
                            color: Number(p.stock) < 5 ? "var(--ha-red)" : "var(--ha-orange)",
                          }}>
                            {formatQuantity(p.stock)}
                          </span>
                        </td>
                        <td style={{ color: "var(--ha-text-2)" }}>{p.category?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ha-cardlist" style={{ padding: "8px 12px", gap: 0 }}>
                {stats.lowStockProducts.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px", borderBottom: "1px solid var(--ha-border)" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        display: "inline-grid", placeItems: "center", minWidth: 36, height: 24,
                        padding: "0 8px", borderRadius: 7, fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13,
                        background: Number(p.stock) < 5 ? "var(--ha-red-soft)" : "rgba(251,146,60,0.16)",
                        color: Number(p.stock) < 5 ? "var(--ha-red)" : "var(--ha-orange)",
                      }}>
                        {formatQuantity(p.stock)}
                      </span>
                      <span style={{ color: "var(--ha-text-3)", fontSize: 12 }}>{p.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ padding: "12px 20px", textAlign: "right", borderTop: "1px solid var(--ha-border)" }}>
            <Link href="/products" style={{ color: "var(--ha-amber)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              Ver stock completo →
            </Link>
          </div>
        </div>
      </div>

      <div className={`ha-collapse${helpOpen ? " is-open" : ""}`}>
        <div className="ha-collapse__head" onClick={() => setHelpOpen((o) => !o)}>
          <Wallet size={15} style={{ color: "var(--ha-amber)", flexShrink: 0 }} />
          Cómo se calcula la caja
          <ChevronDown size={16} className="ha-collapse__chev" />
        </div>
        {helpOpen && (
          <div className="ha-collapse__body">
            La caja se calcula sumando el efectivo inicial (apertura) más las ventas en efectivo, menos los
            egresos en efectivo, desde la fecha de corte configurada. Hacé clic en el card de &quot;Caja disponible&quot; para
            configurar el saldo inicial y la fecha de corte.
          </div>
        )}
      </div>

      {/* Cash flow modal */}
      {cashFlowModalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setCashFlowModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Caja: saldos y movimiento</span>
              <button className="ha-iconbtn" onClick={() => setCashFlowModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <div style={{ background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "var(--ha-text-2)", lineHeight: 1.6 }}>
                Definí cuánto tenés hoy en efectivo y en transferencia, y desde qué fecha deben sumarse las{" "}
                <strong style={{ color: "var(--ha-text)" }}>órdenes y gastos nuevos</strong> para no duplicar lo histórico.
              </div>

              <div className="ha-formgrid" style={{ marginBottom: 16 }}>
                <div className="ha-field">
                  <label className="ha-label">Efectivo inicial (hoy)</label>
                  <input
                    type="number"
                    className={`ha-input${formErrors.cash ? " ha-input--error" : ""}`}
                    value={formCash}
                    onChange={(e) => setFormCash(e.target.value)}
                    min={0}
                    step={1}
                  />
                  {formErrors.cash && <span className="ha-error">{formErrors.cash}</span>}
                </div>
                <div className="ha-field">
                  <label className="ha-label">Transferencia inicial (hoy)</label>
                  <input
                    type="number"
                    className={`ha-input${formErrors.card ? " ha-input--error" : ""}`}
                    value={formCard}
                    onChange={(e) => setFormCard(e.target.value)}
                    min={0}
                    step={1}
                  />
                  {formErrors.card && <span className="ha-error">{formErrors.card}</span>}
                </div>
                <div className="ha-field">
                  <label className="ha-label">Contar órdenes y gastos desde</label>
                  <input
                    type="datetime-local"
                    className={`ha-input${formErrors.since ? " ha-input--error" : ""}`}
                    value={formSince}
                    onChange={(e) => setFormSince(e.target.value)}
                  />
                  {formErrors.since && <span className="ha-error">{formErrors.since}</span>}
                </div>
                <button className="ha-btn ha-btn--primary" onClick={saveBaseline} disabled={savingBaseline} style={{ opacity: savingBaseline ? 0.6 : 1 }}>
                  {savingBaseline ? "Guardando…" : "Guardar saldos"}
                </button>
              </div>

              {baseline ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
                    <div>
                      <p style={{ color: "var(--ha-text)", margin: 0, fontWeight: 600 }}>Efectivo</p>
                      <p style={{ color: "var(--ha-text-3)", margin: "8px 0 0", fontSize: 13 }}>Inicial: {formatCurrency(baseline.openingCash)}</p>
                      <p style={{ color: "var(--ha-text-3)", margin: "4px 0 0", fontSize: 13 }}>
                        + Ventas: <span style={{ color: "var(--ha-green)" }}>{formatCurrency(cash.deltaCashIn)}</span>
                      </p>
                      <p style={{ color: "var(--ha-text-3)", margin: "4px 0 0", fontSize: 13 }}>
                        − Gastos: <span style={{ color: "var(--ha-red)" }}>{formatCurrency(cash.deltaCashOut)}</span>
                      </p>
                      <p style={{ color: "var(--ha-text)", margin: "8px 0 0", fontWeight: 600 }}>= {formatCurrency(cash.balanceCash)}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--ha-text)", margin: 0, fontWeight: 600 }}>Transferencia</p>
                      <p style={{ color: "var(--ha-text-3)", margin: "8px 0 0", fontSize: 13 }}>Inicial: {formatCurrency(baseline.openingCard)}</p>
                      <p style={{ color: "var(--ha-text-3)", margin: "4px 0 0", fontSize: 13 }}>
                        + Ventas: <span style={{ color: "var(--ha-green)" }}>{formatCurrency(cash.deltaCardIn)}</span>
                      </p>
                      <p style={{ color: "var(--ha-text-3)", margin: "4px 0 0", fontSize: 13 }}>
                        − Gastos: <span style={{ color: "var(--ha-red)" }}>{formatCurrency(cash.deltaCardOut)}</span>
                      </p>
                      <p style={{ color: "var(--ha-text)", margin: "8px 0 0", fontWeight: 600 }}>= {formatCurrency(cash.balanceCard)}</p>
                    </div>
                  </div>
                  <p style={{ color: "var(--ha-text)", margin: "16px 0 0", fontWeight: 600 }}>
                    Total caja: {formatCurrency(cash.total)}
                  </p>
                  <p style={{ color: "var(--ha-text-3)", fontSize: 12, marginTop: 8 }}>
                    Corte: {new Date(baseline.deltaSince).toLocaleString("es-AR")}
                  </p>
                </>
              ) : (
                <p style={{ color: "var(--ha-orange)" }}>No se pudo cargar la configuración de caja. Reintentá o revisá la API.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
