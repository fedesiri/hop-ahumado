"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { toast } from "@/lib/toast";
import type { DistributorSuggestedOrderResponse } from "@/lib/types";
import { ChevronDown, Copy, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

type OrderItem = DistributorSuggestedOrderResponse["items"][number];

function boxLabel(n: number) {
  return `${n} ${n === 1 ? "caja" : "cajas"}`;
}

function QtyStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(1000, Math.max(0, Math.floor(n) || 0)));
  return (
    <div className="ps-qty">
      <button type="button" className="ps-qty__b" onClick={() => set(value - 1)} disabled={value <= 0} aria-label="Menos">
        <Minus size={14} />
      </button>
      <input
        type="number" inputMode="numeric" min={0} max={1000} className="ps-qty__i"
        value={value} onChange={(e) => set(Number(e.target.value))} aria-label="Cajas a pedir"
      />
      <button type="button" className="ps-qty__b" onClick={() => set(value + 1)} aria-label="Más">
        <Plus size={14} />
      </button>
    </div>
  );
}

function buildWhatsAppText(categoryName: string, items: OrderItem[], qty: Record<string, number>, unitsPerBox: number) {
  const picked = items.filter((i) => (qty[i.productId] ?? 0) > 0);
  const date = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const lines: string[] = [`Pedido ${categoryName} — ${date}`];
  if (picked.length === 0) return lines.concat("", "(Sin productos para pedir)").join("\n");
  const groups: Array<[string, OrderItem[]]> = [
    ["1 L", picked.filter((i) => i.format === "LITER")],
    ["½ L", picked.filter((i) => i.format !== "LITER")],
  ];
  for (const [label, rows] of groups) {
    if (rows.length === 0) continue;
    lines.push("", label);
    for (const r of rows) {
      const boxes = qty[r.productId];
      const price = r.unitCost != null ? ` — ${formatCurrency(boxes * unitsPerBox * r.unitCost)}` : "";
      lines.push(`• ${r.name}: ${boxLabel(boxes)} (${boxes * unitsPerBox} u)${price}`);
    }
  }
  const totalBoxes = picked.reduce((a, i) => a + qty[i.productId], 0);
  const totalCost = picked.reduce((a, i) => a + (i.unitCost != null ? qty[i.productId] * unitsPerBox * i.unitCost : 0), 0);
  const totalPrice = totalCost > 0 ? ` — aprox. ${formatCurrency(Math.round(totalCost * 100) / 100)}` : "";
  lines.push("", `Total: ${boxLabel(totalBoxes)} (${totalBoxes * unitsPerBox} u)${totalPrice}`);
  return lines.join("\n");
}

export default function SuggestedOrderPage() {
  return <SuggestedOrderContent />;
}

function SuggestedOrderContent() {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<DistributorSuggestedOrderResponse | null>(null);
  const [params, setParams] = useState({ literTargetBoxes: 5, halfLiterTargetBoxes: 6, unitsPerBox: 12 });
  const [infoOpen, setInfoOpen] = useState(true);
  // Cajas a pedir por producto (editable; arranca con lo sugerido).
  const [qty, setQty] = useState<Record<string, number>>({});
  // Si el usuario edita el texto de WhatsApp a mano, se guarda acá hasta que cambie una cantidad.
  const [textOverride, setTextOverride] = useState<string | null>(null);

  const calcular = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDistributorSuggestedOrder(params);
      setOrder(res);
      setQty(Object.fromEntries(res.items.map((i) => [i.productId, i.suggestedBoxes])));
      setTextOverride(null);
    } catch {
      toast.error("No se pudo generar el pedido sugerido");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const setItemQty = (productId: string, n: number) => {
    setQty((q) => ({ ...q, [productId]: n }));
    setTextOverride(null);
  };

  const unitsPerBox = order?.parameters.unitsPerBox ?? params.unitsPerBox;

  const waText = useMemo(
    () => (order ? buildWhatsAppText(order.parameters.categoryName, order.items, qty, order.parameters.unitsPerBox) : ""),
    [order, qty],
  );
  const finalText = textOverride ?? waText;

  const totals = useMemo(() => {
    if (!order) return { boxes: 0, lines: 0, approx: 0, missingCost: 0 };
    let boxes = 0, lines = 0, approx = 0, missingCost = 0;
    for (const i of order.items) {
      const b = qty[i.productId] ?? 0;
      if (b <= 0) continue;
      boxes += b;
      lines += 1;
      if (i.unitCost == null) missingCost += 1;
      else approx += b * order.parameters.unitsPerBox * i.unitCost;
    }
    return { boxes, lines, approx: Math.round(approx * 100) / 100, missingCost };
  }, [order, qty]);

  const copyWA = async () => {
    if (!finalText.trim() || totals.lines === 0) return;
    try {
      await navigator.clipboard.writeText(finalText);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>
          Pedido Sugerido
          <span style={{ color: "var(--ha-text-3)", fontWeight: 400, fontSize: "0.72em", marginLeft: 10 }}>
            · Distribuidora
          </span>
        </h1>
      </div>

      {/* Params card */}
      <div className="ps-card ps-card--pad">
        <div className="ps-card__h">Parámetros del pedido</div>
        <div className="ps-card__sub">Ingresá la cantidad de cajas objetivo por formato</div>
        <div className="ps-params">
          <div className="ps-field">
            <label className="ps-label">Cajas objetivo (1 litro)</label>
            <input
              type="number" className="ps-input" min={1} max={1000}
              value={params.literTargetBoxes}
              onChange={(e) => setParams((p) => ({ ...p, literTargetBoxes: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
          <div className="ps-field">
            <label className="ps-label">Cajas objetivo (½ litro)</label>
            <input
              type="number" className="ps-input" min={1} max={1000}
              value={params.halfLiterTargetBoxes}
              onChange={(e) => setParams((p) => ({ ...p, halfLiterTargetBoxes: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
          <div className="ps-field">
            <label className="ps-label">Unidades por caja</label>
            <input
              type="number" className="ps-input" min={1} max={1000}
              value={params.unitsPerBox}
              onChange={(e) => setParams((p) => ({ ...p, unitsPerBox: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
          <button
            className="pc-btn pc-btn--primary ps-calcbtn"
            style={{ height: 44, alignSelf: "flex-end", flexShrink: 0 }}
            onClick={() => void calcular()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span style={{
                  display: "inline-block", width: 14, height: 14, borderRadius: "50%",
                  border: "2px solid rgba(0,0,0,0.25)", borderTopColor: "#000",
                  animation: "ha-spin .7s linear infinite",
                }} />
                Calculando…
              </>
            ) : "Calcular"}
          </button>
        </div>
      </div>

      {/* Info collapsible */}
      <div className={"ps-collapse" + (infoOpen ? " open" : "")}>
        <div className="ps-collapse__h" onClick={() => setInfoOpen((v) => !v)} role="button" aria-expanded={infoOpen}>
          <span>ℹ️</span>
          <span>Cómo funciona</span>
          <ChevronDown size={16} className="ps-collapse__chev" />
        </div>
        {infoOpen && (
          <div className="ps-collapse__b">
            Las <b>cajas sugeridas</b> salen de: (objetivo en unidades) − stock actual, redondeado a cajas completas. Después podés cambiar las cajas de cada producto antes de copiar el mensaje. El total aproximado usa el último costo registrado de cada producto.
          </div>
        )}
      </div>

      {/* Results */}
      {order && (
        <>
          <div className="ps-step">
            <span className="ps-step__n">1</span> Revisá y ajustá las cajas a pedir
          </div>
          <div className="pc-card" style={{ marginBottom: 16 }}>
            {/* Desktop table */}
            <div className="ps-tablewrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Formato</th>
                    <th className="r">Stock actual</th>
                    <th className="r">Objetivo</th>
                    <th className="r">Sugerido</th>
                    <th className="r">Cajas a pedir</th>
                    <th className="r">Total aprox.</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => {
                    const b = qty[item.productId] ?? 0;
                    const line = item.unitCost != null ? b * unitsPerBox * item.unitCost : null;
                    return (
                      <tr key={item.productId}>
                        <td style={{ minWidth: 180 }}>{item.name}</td>
                        <td>
                          <span className={"ps-fmt " + (item.format === "LITER" ? "ps-fmt--1" : "ps-fmt--h")}>
                            {item.format === "LITER" ? "1 L" : "½ L"}
                          </span>
                        </td>
                        <td className="r">{item.currentStock}</td>
                        <td className="r">{item.targetUnits}</td>
                        <td className="r" style={{ color: "var(--ha-text-3)" }}>
                          {item.suggestedBoxes > 0 ? item.suggestedBoxes : "—"}
                        </td>
                        <td className="r">
                          <QtyStepper value={b} onChange={(n) => setItemQty(item.productId, n)} />
                        </td>
                        <td className={"r" + (b > 0 ? " ps-sugcell" : "")}>
                          {b > 0 && line != null
                            ? <span className="ps-sug">{formatCurrency(line)}</span>
                            : <span style={{ color: "var(--ha-text-3)" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="ps-tfoot">
                  <tr>
                    <td colSpan={5}>Total · {boxLabel(totals.boxes)}</td>
                    <td />
                    <td className="amt">{formatCurrency(totals.approx)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="ps-cardlist">
              {order.items.map((item) => {
                const b = qty[item.productId] ?? 0;
                const line = item.unitCost != null ? b * unitsPerBox * item.unitCost : null;
                return (
                  <div key={item.productId} className={"ps-pcard" + (b > 0 ? " has" : "")}>
                    <div className="ps-pcard__top">
                      <span className="ps-pcard__n">{item.name}</span>
                      <span className={"ps-fmt " + (item.format === "LITER" ? "ps-fmt--1" : "ps-fmt--h")}>
                        {item.format === "LITER" ? "1 L" : "½ L"}
                      </span>
                    </div>
                    <div className="ps-pcard__mid">
                      <span>Stock: <strong style={{ color: "var(--ha-text)" }}>{item.currentStock}</strong></span>
                      <span>Objetivo: <strong style={{ color: "var(--ha-text)" }}>{item.targetUnits}</strong></span>
                      <span>Sugerido: <strong style={{ color: "var(--ha-text)" }}>{item.suggestedBoxes}</strong></span>
                    </div>
                    <div className="ps-pcard__bot">
                      <QtyStepper value={b} onChange={(n) => setItemQty(item.productId, n)} />
                      {b > 0 && line != null && <span className="ps-pcard__total">{formatCurrency(line)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ps-step">
            <span className="ps-step__n">2</span> Copiá el mensaje y mandalo por WhatsApp
          </div>
          <div className="ps-card">
            <div className="ps-summary">
              <div>
                <p className="ps-sumtot">{boxLabel(totals.boxes)} · {totals.lines} {totals.lines === 1 ? "producto" : "productos"}</p>
                <p className="ps-sumstat">
                  Costo aprox.: <strong>{formatCurrency(totals.approx)}</strong>
                </p>
                {totals.missingCost > 0 && (
                  <p className="ps-sumstat">
                    {totals.missingCost} {totals.missingCost === 1 ? "producto" : "productos"} sin costo registrado (no suma al total)
                  </p>
                )}
                <button
                  className="pc-btn pc-btn--primary"
                  style={{ width: "100%", height: 44, justifyContent: "center", gap: 8, marginTop: 14 }}
                  onClick={() => void copyWA()}
                  disabled={totals.lines === 0}
                >
                  <Copy size={15} /> Copiar para WhatsApp
                </button>
              </div>
              <div>
                <div className="ps-sumstat" style={{ marginBottom: 6 }}>
                  Así va a quedar el mensaje (podés editarlo):
                </div>
                <textarea
                  className="ps-wa"
                  style={{ marginTop: 0 }}
                  value={finalText}
                  onChange={(e) => setTextOverride(e.target.value)}
                  rows={Math.min(14, Math.max(5, finalText.split("\n").length + 1))}
                />
              </div>
            </div>
          </div>

          {/* Unknown format warning */}
          {order.unknownFormat.length > 0 && (
            <div className="ps-warn">
              <b>
                ⚠ {order.unknownFormat.length}{" "}
                {order.unknownFormat.length === 1 ? "producto sin formato reconocido" : "productos sin formato reconocido"}
                {" "}· No se incluyó en el cálculo:
              </b>
              <div className="ps-warn__row">
                {order.unknownFormat.map((u) => `${u.name} · ${u.currentStock} UN en stock`).join(" · ")}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
