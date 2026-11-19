"use client";

import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import type { Product } from "@/lib/types";

export interface PurchaseStockRow {
  productId: string;
  quantity: string;
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
    .map((r) => ({ productId: r.productId, quantity: num(r.quantity) }))
    .filter((r) => r.productId && r.quantity > 0);
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
}: {
  products: Product[];
  rows: PurchaseStockRow[];
  onChange: (rows: PurchaseStockRow[]) => void;
  category: string;
  amount: number;
}) {
  const expectsStock = STOCK_CATEGORIES.includes(category);
  const byId = new Map(products.map((p) => [p.id, p]));
  const chosen = new Set(rows.map((r) => r.productId));
  const update = (i: number, patch: Partial<PurchaseStockRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const filled = validPurchaseRows(rows);
  const singleCost =
    filled.length === 1 && amount > 0 ? { unit: byId.get(filled[0].productId)?.unit, value: amount / filled[0].quantity } : null;

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
        {singleCost && singleCost.value > 0 && (
          <span style={{ fontSize: 12, color: "var(--ha-text-3)" }}>
            Sale ≈ {formatCurrency(singleCost.value)} por {UNIT[singleCost.unit ?? ""] ?? "unidad"}
          </span>
        )}
        {filled.length > 1 && (
          <span style={{ fontSize: 12, color: "var(--ha-text-3)" }}>
            Con varios productos, el monto del gasto es el total de la compra.
          </span>
        )}
      </div>
    </div>
  );
}
