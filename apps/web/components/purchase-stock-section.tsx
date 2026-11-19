"use client";

import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import type { Product } from "@/lib/types";

export interface PurchaseStockRow {
  productId: string;
  quantity: string;
  /** $ pagados por este producto; solo se pide cuando la compra tiene varios productos. */
  amount?: string;
}

const UNIT: Record<string, string> = { UNIT: "un", KG: "kg", G: "g", L: "L", ML: "ml" };

/** Categorías de gasto que normalmente son mercadería que entra a stock. */
export const STOCK_CATEGORIES = ["Materia prima", "Packaging", "Carbón / Leña"];

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** En kg/L, 200 o más casi siempre es un valor cargado en gramos/ml. */
export function isSuspiciousQuantity(unit: string | undefined, qty: number): boolean {
  return (unit === "KG" || unit === "L") && qty >= 200;
}

/** Filas válidas (producto elegido y cantidad mayor a 0) listas para enviar. */
export function validPurchaseRows(rows: PurchaseStockRow[]) {
  return rows
    .map((r) => ({ productId: r.productId, quantity: num(r.quantity), amount: r.amount ? num(r.amount) : undefined }))
    .filter((r) => r.productId && r.quantity > 0)
    .map((r) => (r.amount && r.amount > 0 ? r : { productId: r.productId, quantity: r.quantity }));
}

/**
 * Sección del gasto donde se elige qué productos de stock entraron con la compra.
 * Al guardar el gasto, el stock de cada producto sube solo.
 */
export function PurchaseStockSection({
  products,
  rows,
  onChange,
  category,
  amount,
  costs,
  updateCosts,
  onUpdateCosts,
}: {
  products: Product[];
  rows: PurchaseStockRow[];
  onChange: (rows: PurchaseStockRow[]) => void;
  category: string;
  amount: number;
  /** Costo activo por unidad de cada producto (para mostrar cómo cambia). */
  costs: Record<string, number>;
  updateCosts: boolean;
  onUpdateCosts: (v: boolean) => void;
}) {
  const expectsStock = STOCK_CATEGORIES.includes(category);
  const byId = new Map(products.map((p) => [p.id, p]));
  const chosen = new Set(rows.map((r) => r.productId));
  const update = (i: number, patch: Partial<PurchaseStockRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const filled = validPurchaseRows(rows);
  const multi = rows.length > 1;
  /** Costo por unidad que resultaría de esta compra para una fila (null si no se puede calcular). */
  const newUnitCost = (r: PurchaseStockRow): number | null => {
    const q = num(r.quantity);
    const paid = multi ? num(r.amount ?? "") : amount;
    return q > 0 && paid > 0 ? paid / q : null;
  };
  const anyCost = rows.some((r) => newUnitCost(r) !== null);

  if (rows.length === 0) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${expectsStock ? "var(--ha-amber, #d97706)" : "var(--ha-border)"}`,
          background: expectsStock ? "var(--ha-amber-bg, rgba(217,119,6,0.08))" : "transparent",
        }}
      >
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          {expectsStock ? (
            <>
              <b>Esta compra todavía no suma stock.</b> Si compraste mercadería (carne, insumos, packaging), elegí qué
              producto y cuánto, y el stock sube solo al guardar.
            </>
          ) : (
            <>¿Esta compra incluye productos de stock? Si es así, agregalos y el stock sube solo al guardar.</>
          )}
        </div>
        <button type="button" className="ha-btn ha-btn--secondary" onClick={() => onChange([{ productId: "", quantity: "" }])}>
          ＋ Agregar producto que entra a stock
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, padding: "12px", borderRadius: 8, border: "1px solid var(--ha-border)" }}>
      <div className="ha-label" style={{ marginBottom: 2 }}>Stock que entra con esta compra</div>
      <div style={{ fontSize: 12, color: "var(--ha-text-3)", marginBottom: 10 }}>
        Al guardar el gasto, se suma al stock con la fecha del gasto. Cargá las cantidades en kg o litros, no en gramos.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r, i) => {
          const p = byId.get(r.productId);
          const q = num(r.quantity);
          const suspicious = isSuspiciousQuantity(p?.unit, q);
          return (
            <div key={i} style={{ paddingBottom: 10, borderBottom: "1px solid var(--ha-border)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="ha-select"
                  style={{ flex: 1, minWidth: 0 }}
                  value={r.productId}
                  onChange={(e) => update(i, { productId: e.target.value })}
                  aria-label="Producto"
                >
                  <option value="">Elegí el producto…</option>
                  {products
                    .filter((x) => x.id === r.productId || !chosen.has(x.id))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({UNIT[x.unit] ?? ""}) · stock {formatQuantity(x.stock)}
                      </option>
                    ))}
                </select>
                <input
                  className="ha-input"
                  style={{ width: 96, textAlign: "right" }}
                  inputMode="decimal"
                  placeholder="Cant."
                  value={r.quantity}
                  onChange={(e) => update(i, { quantity: e.target.value })}
                  aria-label="Cantidad"
                />
                <span style={{ width: 24, fontSize: 12, color: "var(--ha-text-2)" }}>{p ? (UNIT[p.unit] ?? "") : ""}</span>
                <button
                  type="button"
                  className="ha-iconbtn"
                  aria-label="Quitar producto"
                  onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
              {multi && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input
                    className="ha-input"
                    style={{ width: 130, textAlign: "right" }}
                    inputMode="decimal"
                    placeholder="$ de este producto"
                    value={r.amount ?? ""}
                    onChange={(e) => update(i, { amount: e.target.value })}
                    aria-label="Importe de este producto"
                  />
                  <span style={{ fontSize: 12, color: "var(--ha-text-3)" }}>opcional · sirve para actualizar su costo</span>
                </div>
              )}
              {p && q > 0 && newUnitCost(r) !== null && updateCosts && (
                <div style={{ fontSize: 12, marginTop: 4, color: "var(--ha-text-3)" }}>
                  Costo por {UNIT[p.unit] ?? "unidad"}: {costs[p.id] != null ? `${formatCurrency(costs[p.id])} → ` : "nuevo: "}
                  <b>{formatCurrency(newUnitCost(r)!)}</b>
                </div>
              )}
              {p && q > 0 && (
                <div style={{ fontSize: 12, marginTop: 4, color: suspicious ? "var(--ha-red)" : "var(--ha-text-3)" }}>
                  {suspicious ? (
                    <>⚠ {formatQuantity(q)} {UNIT[p.unit]} es mucho. ¿Lo pusiste en gramos? Acá va en kg o litros (3,1 y no 3100). </>
                  ) : null}
                  Stock: {formatQuantity(p.stock)} → <b>{formatQuantity(p.stock + q)} {UNIT[p.unit]}</b>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="ha-btn ha-btn--secondary"
          onClick={() => onChange([...rows, { productId: "", quantity: "" }])}
        >
          ＋ Otro producto
        </button>
        {filled.length > 1 && (
          <span style={{ fontSize: 12, color: "var(--ha-text-3)" }}>
            Con varios productos, el monto del gasto es el total de la compra.
          </span>
        )}
      </div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, fontSize: 13 }}>
        <input type="checkbox" checked={updateCosts} onChange={(e) => onUpdateCosts(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          Actualizar el costo de estos productos con el precio de esta compra
          {!anyCost && updateCosts && (
            <span style={{ display: "block", fontSize: 12, color: "var(--ha-text-3)" }}>
              {multi ? "Completá el $ de cada producto para que se actualice su costo." : "Completá el monto del gasto para calcularlo."}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
