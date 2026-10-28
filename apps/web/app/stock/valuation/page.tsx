"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { classifyBeerFormat, type ClassifiedBeerFormat } from "@/lib/beer-format.util";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import { ProductUnit, type StockValuationResponse } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const FORMAT_OPTIONS: { value: "" | ClassifiedBeerFormat; label: string }[] = [
  { value: "", label: "Todos los formatos" },
  { value: "HALF_LITER", label: "½ litro" },
  { value: "LITER", label: "1 litro" },
  { value: "UNKNOWN", label: "Otros (copas, vasos, estuches)" },
];

function formatPct(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export default function StockValuationPage() {
  return <StockValuationContent />;
}

function StockValuationContent() {
  const { selectedLineId } = useLineContext();
  const [data, setData] = useState<StockValuationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [formatFilter, setFormatFilter] = useState<"" | ClassifiedBeerFormat>("");

  useEffect(() => {
    if (!selectedLineId) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .getStockValuation(selectedLineId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("No se pudo calcular la valorización del stock");
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLineId]);

  const rows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (formatFilter && classifyBeerFormat(r.name, r.unit as ProductUnit) !== formatFilter) return false;
      return true;
    });
  }, [data, searchText, formatFilter]);

  const totals = useMemo(() => {
    const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);
    return {
      units: sum((r) => r.quantity),
      factory: sum((r) => r.factoryValue),
      retail: sum((r) => r.retailValue),
      wholesale: sum((r) => r.wholesaleValue),
      expected: rows.every((r) => r.expectedValue != null) ? sum((r) => r.expectedValue ?? 0) : null,
    };
  }, [rows]);

  const example = useMemo(
    () => rows.find((r) => r.mixSource === "product" && r.retailShare != null && r.retailPrice != null && r.wholesalePrice != null),
    [rows],
  );

  const cards: { label: string; sub: string; value: number | null; highlight?: boolean }[] = [
    { label: "Todo a precio fábrica", sub: "Lo que costaría reponerlo", value: totals.factory },
    { label: "Todo a precio minorista", sub: "Si se vendiera todo al público", value: totals.retail },
    { label: "Todo a precio mayorista", sub: "Si se vendiera todo a comercios", value: totals.wholesale },
    {
      label: "Valor esperado de venta",
      sub: "Cada cerveza valorizada según cómo se vendió históricamente (minorista vs mayorista)",
      value: totals.expected,
      highlight: true,
    },
  ];

  const warnings = data?.warnings;
  const hasWarnings = !!warnings && warnings.negativeStockProducts.length + warnings.missingPriceProducts.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>
          Stock · Valorización
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ha-text-2)", maxWidth: 760 }}>
          Cuánta plata hay parada en stock. Las tres primeras tarjetas suponen que se vende todo a un mismo precio. El <b>valor esperado</b> es más
          realista: supone que cada cerveza se vende en la misma proporción minorista / mayorista en que se vendió históricamente.
        </p>
      </div>

      <div className="pc-filter" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="pc-search">
          <Search size={17} />
          <input placeholder="Buscar producto…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <select className="pc-select" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value as "" | ClassifiedBeerFormat)}>
          {FORMAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pc-count">
          {rows.length} {rows.length === 1 ? "producto" : "productos"} · {formatQuantity(totals.units)} u.
        </span>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : !data ? null : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
            {cards.map((c) => (
              <div key={c.label} className="ha-stat" style={c.highlight ? { borderColor: "var(--ha-amber)" } : undefined}>
                <div className="ha-stat__l">{c.label}</div>
                <div className="ha-stat__v">{c.value == null ? "—" : formatCurrency(c.value)}</div>
                <div className="ha-stat__s">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="ps-card ps-card--pad">
            <div className="ps-card__h">Cómo se calcula el valor esperado</div>
            <div className="ps-card__sub">
              Valor esperado = cantidad en stock × (% vendido minorista × precio minorista + % vendido mayorista × precio mayorista)
            </div>
            <div className="ha-stat__s" style={{ marginTop: 10 }}>
              El porcentaje sale de las ventas de cada cerveza. Si vendió menos de 12 unidades no hay datos suficientes y se usa el porcentaje de
              todas las ventas juntas (se marca con *).
            </div>
            {example && (
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--ha-text-2)" }}>
                <b>Ejemplo con {example.name}:</b> {formatQuantity(example.quantity)} u. × ({formatPct(example.retailShare)} ×{" "}
                {formatCurrency(example.retailPrice)} + {formatPct(example.wholesaleShare)} × {formatCurrency(example.wholesalePrice)}) ={" "}
                <b>{formatCurrency(example.expectedValue)}</b>
              </div>
            )}
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginTop: 16 }}>
              <div>
                <div className="ps-label">Ventas totales minorista</div>
                <div className="us-stat__v">{formatPct(data.mix.retailPct)}</div>
                <div className="ha-stat__s">{formatQuantity(data.mix.retailUnits)} unidades</div>
              </div>
              <div>
                <div className="ps-label">Ventas totales mayorista</div>
                <div className="us-stat__v">{formatPct(data.mix.wholesalePct)}</div>
                <div className="ha-stat__s">{formatQuantity(data.mix.wholesaleUnits)} unidades</div>
              </div>
            </div>
            <div className="ha-stat__s" style={{ marginTop: 12 }}>
              Los pedidos anteriores al 20/04/2026 no guardan la lista de precios: se clasificaron por el precio cobrado y, si no coincidía con
              ninguna lista, por el tipo de cliente ({formatQuantity(data.mix.inferredUnits)} unidades). No entran al porcentaje:{" "}
              {formatQuantity(data.mix.otherListUnits)} unidades vendidas a precio fábrica o catering y{" "}
              {formatQuantity(data.mix.unclassifiedUnits)} que no se pudieron clasificar.
            </div>
          </div>

          {hasWarnings && warnings && (
            <div className="ps-warn">
              <b>⚠ Datos incompletos</b>
              {warnings.negativeStockProducts.length > 0 && (
                <div className="ps-warn__row">Stock negativo (se valoriza en 0): {warnings.negativeStockProducts.join(", ")}</div>
              )}
              {warnings.missingPriceProducts.length > 0 && (
                <div className="ps-warn__row">Sin precio en alguna lista: {warnings.missingPriceProducts.join(", ")}</div>
              )}
            </div>
          )}

          <div className="pc-card" style={{ marginTop: 16 }}>
            {rows.length === 0 ? (
              <div className="ha-empty">
                <p className="ha-empty__t">Sin resultados para los filtros aplicados</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="pc-table" style={{ minWidth: 880 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "auto" }}>Producto</th>
                      <th style={{ textAlign: "right" }}>Stock</th>
                      <th style={{ textAlign: "right" }}>Fábrica</th>
                      <th style={{ textAlign: "right" }}>Minorista</th>
                      <th style={{ textAlign: "right" }}>Mayorista</th>
                      <th style={{ textAlign: "right" }}>% vendido min / may</th>
                      <th style={{ textAlign: "right" }}>Valor esperado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.productId}>
                        <td style={{ fontWeight: 500 }}>{r.name}</td>
                        <td style={{ textAlign: "right" }}>{formatQuantity(r.quantity)}</td>
                        <td style={{ textAlign: "right" }}>{r.factoryPrice != null ? formatCurrency(r.factoryPrice) : "—"}</td>
                        <td style={{ textAlign: "right" }}>{r.retailPrice != null ? formatCurrency(r.retailPrice) : "—"}</td>
                        <td style={{ textAlign: "right" }}>{r.wholesalePrice != null ? formatCurrency(r.wholesalePrice) : "—"}</td>
                        <td style={{ textAlign: "right", color: "var(--ha-text-2)" }}>
                          {formatPct(r.retailShare)} / {formatPct(r.wholesaleShare)}
                          {r.mixSource === "global" && <span title="Pocas ventas: usa el porcentaje de todas las ventas"> *</span>}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{r.expectedValue != null ? formatCurrency(r.expectedValue) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ padding: "12px 18px", fontWeight: 600 }}>Total</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatQuantity(totals.units)}</td>
                      <td colSpan={4} />
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{totals.expected != null ? formatCurrency(totals.expected) : "—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          <p className="ha-stat__s" style={{ marginTop: 10 }}>
            * Producto con menos de 12 unidades vendidas: usa el porcentaje de todas las ventas.
          </p>
        </div>
      )}
    </div>
  );
}
