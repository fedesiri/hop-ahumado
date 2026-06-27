"use client";

import { classifyBeerFormat, compareBeerFormatThenName, type ClassifiedBeerFormat } from "@/lib/beer-format.util";
import { parseStockQuantity } from "@/lib/format-box-quantity";
import { formatQuantity } from "@/lib/format-currency";
import type { StockBalanceRow } from "@/lib/types";
import { ProductUnit } from "@/lib/types";
import { Package, Search } from "lucide-react";
import { useMemo, useState } from "react";

const SECTIONS: { key: ClassifiedBeerFormat; title: string; short: string; accent: string }[] = [
  { key: "HALF_LITER", title: "Medio litro", short: "½L", accent: "#0891b2" },
  { key: "LITER",      title: "Litro",       short: "1L", accent: "#2563eb" },
  { key: "UNKNOWN",    title: "Otros productos", short: "—", accent: "#64748b" },
];

type LocationStockModalProps = {
  open: boolean;
  locationName: string | null;
  loading: boolean;
  balances: StockBalanceRow[];
  onClose: () => void;
};

function StockQuantityCell({ quantity, unit }: { quantity: number; unit: ProductUnit }) {
  const parsed = parseStockQuantity(quantity, unit);

  if (parsed.kind === "other") {
    return (
      <span style={{
        display: "inline-block", padding: "4px 10px", borderRadius: 6,
        background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border-2)",
        color: "var(--ha-text)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums",
      }}>
        {parsed.sign}{parsed.label}
      </span>
    );
  }

  const chips: { key: string; label: string; primary?: boolean }[] = [];
  if (parsed.boxes > 0) chips.push({ key: "boxes", label: `${parsed.boxes} ${parsed.boxes === 1 ? "caja" : "cajas"}`, primary: true });
  if (parsed.units > 0) chips.push({ key: "units", label: `${parsed.units} u` });
  if (chips.length === 0 && parsed.frac < 1e-6) chips.push({ key: "zero", label: "0 u" });
  if (parsed.frac >= 1e-6) chips.push({ key: "frac", label: `${formatQuantity(parsed.frac)} u` });

  const emphasize = chips.length === 1;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
      {parsed.sign ? <span style={{ color: "var(--ha-red)", fontWeight: 700, alignSelf: "center" }}>{parsed.sign}</span> : null}
      {chips.map((chip) => {
        const primary = chip.primary || emphasize;
        return (
          <span
            key={chip.key}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
              background: primary ? "var(--ha-blue-soft)" : "var(--ha-bg-raised)",
              border: primary ? "1px solid rgba(96,165,250,0.45)" : "1px solid var(--ha-border-2)",
              color: primary ? "var(--ha-blue)" : "var(--ha-text)",
            }}
          >
            {chip.key === "boxes" && <Package size={12} />}
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}

export function LocationStockModal({ open, locationName, loading, balances, onClose }: LocationStockModalProps) {
  const [filter, setFilter] = useState("");
  if (!open) return null;
  const handleClose = () => { setFilter(""); onClose(); };
  return (
    <LocationStockModalInner
      locationName={locationName} loading={loading} balances={balances}
      filter={filter} setFilter={setFilter} handleClose={handleClose}
    />
  );
}

function LocationStockModalInner({
  locationName, loading, balances, filter, setFilter, handleClose,
}: {
  locationName: string | null; loading: boolean; balances: StockBalanceRow[];
  filter: string; setFilter: (v: string) => void; handleClose: () => void;
}) {
  const nonzeroBalances = useMemo(() => balances.filter((r) => Math.abs(Number(r.quantity)) > 1e-6), [balances]);

  const displayedBalances = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? nonzeroBalances.filter((r) => (r.product?.name ?? r.productId).toLowerCase().includes(q))
      : nonzeroBalances;
    return [...filtered].sort((a, b) => {
      const nameA = a.product?.name ?? a.productId;
      const nameB = b.product?.name ?? b.productId;
      const unitA = a.product?.unit ?? ProductUnit.UNIT;
      const unitB = b.product?.unit ?? ProductUnit.UNIT;
      return compareBeerFormatThenName({ name: nameA, unit: unitA }, { name: nameB, unit: unitB });
    });
  }, [nonzeroBalances, filter]);

  const balancesBySection = useMemo(() => {
    const map = new Map<ClassifiedBeerFormat, StockBalanceRow[]>();
    for (const section of SECTIONS) map.set(section.key, []);
    for (const row of displayedBalances) {
      const name = row.product?.name ?? row.productId;
      const unit = row.product?.unit ?? ProductUnit.UNIT;
      map.get(classifyBeerFormat(name, unit))!.push(row);
    }
    return map;
  }, [displayedBalances]);

  const hasUnitProducts = nonzeroBalances.some((r) => (r.product?.unit ?? ProductUnit.UNIT) === ProductUnit.UNIT);
  const visibleSections = SECTIONS.filter((s) => (balancesBySection.get(s.key)?.length ?? 0) > 0);

  return (
    <div className="ha-modal-backdrop" onClick={handleClose}>
      <div
        className="ha-modal"
        style={{ maxWidth: "min(680px, calc(100vw - 24px))", width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ha-modal__head">
          <div>
            <div className="ha-modal__title">
              {locationName ? `Stock en «${locationName}»` : "Stock por ubicación"}
            </div>
            {!loading && nonzeroBalances.length > 0 && (
              <div style={{ fontSize: 13, color: "var(--ha-text-3)", fontWeight: 400, marginTop: 2 }}>
                {nonzeroBalances.length} producto{nonzeroBalances.length === 1 ? "" : "s"} con stock
              </div>
            )}
          </div>
          <button className="ha-iconbtn" onClick={handleClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="ha-modal__body" style={{ paddingTop: 4, paddingBottom: 8 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{
                display: "inline-block", width: 32, height: 32, borderRadius: "50%",
                border: "3px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)",
                animation: "ha-spin .7s linear infinite",
              }} />
            </div>
          ) : nonzeroBalances.length === 0 ? (
            <div className="ha-empty" style={{ padding: "32px 0" }}>
              <p className="ha-empty__t">No hay stock en esta ubicación</p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="pc-search" style={{ width: "100%", marginBottom: 12 }}>
                <Search size={16} />
                <input
                  placeholder="Buscar producto…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filtrar productos"
                />
              </div>

              {/* Boxes info banner */}
              {hasUnitProducts && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                  padding: "8px 12px", borderRadius: 8,
                  background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)",
                }}>
                  <Package size={15} style={{ color: "var(--ha-blue)", flexShrink: 0 }} />
                  <span style={{ color: "var(--ha-text-3)", fontSize: 13 }}>
                    Unidades en cajas de <strong style={{ color: "var(--ha-text)" }}>12</strong>
                  </span>
                </div>
              )}

              {displayedBalances.length === 0 ? (
                <div className="ha-empty" style={{ padding: "24px 0" }}>
                  <p className="ha-empty__t">Ningún producto coincide con la búsqueda</p>
                </div>
              ) : (
                <div style={{
                  borderRadius: 10, border: "1px solid var(--ha-border)",
                  background: "var(--ha-bg-card)", overflow: "hidden",
                  maxHeight: "min(58vh, 520px)", overflowY: "auto",
                }}>
                  {/* Sticky header */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(108px,auto)",
                    gap: 16, padding: "10px 16px",
                    background: "var(--ha-bg-raised)", borderBottom: "1px solid var(--ha-border)",
                    position: "sticky", top: 0, zIndex: 1,
                  }}>
                    <span style={{ color: "var(--ha-text-3)", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>Producto</span>
                    <span style={{ color: "var(--ha-text-3)", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", textAlign: "right" }}>Cantidad</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "14px 12px 18px" }}>
                    {visibleSections.map((section) => {
                      const rows = balancesBySection.get(section.key) ?? [];
                      return (
                        <section
                          key={section.key}
                          style={{
                            borderRadius: 8, overflow: "hidden",
                            border: "1px solid var(--ha-border)", background: "var(--ha-bg)",
                          }}
                        >
                          {/* Section header */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                            padding: "9px 14px",
                            background: "var(--ha-bg-raised)",
                            borderLeft: `3px solid ${section.accent}`,
                            borderBottom: "1px solid var(--ha-border)",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              {section.key !== "UNKNOWN" && (
                                <span style={{
                                  display: "inline-block", padding: "2px 7px", borderRadius: 5,
                                  fontSize: 11, fontWeight: 700,
                                  background: `${section.accent}22`, color: section.accent,
                                  border: `1px solid ${section.accent}55`,
                                }}>
                                  {section.short}
                                </span>
                              )}
                              <span style={{ color: "var(--ha-text)", fontWeight: 600, fontSize: 13 }}>{section.title}</span>
                            </div>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              minWidth: 20, height: 20, borderRadius: 10,
                              background: section.accent, color: "#fff",
                              fontSize: 11, fontWeight: 600, padding: "0 5px",
                            }}>
                              {rows.length}
                            </span>
                          </div>

                          {/* Rows */}
                          {rows.map((row, rowIndex) => {
                            const name = row.product?.name ?? row.productId;
                            const unit = row.product?.unit ?? ProductUnit.UNIT;
                            const isLast = rowIndex === rows.length - 1;
                            return (
                              <div
                                key={row.id}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "minmax(0,1fr) minmax(108px,auto)",
                                  gap: 16, alignItems: "center", padding: "11px 14px",
                                  background: rowIndex % 2 === 1 ? "var(--ha-row-alt)" : "transparent",
                                  borderBottom: isLast ? undefined : "1px solid var(--ha-border)",
                                }}
                              >
                                <span style={{ color: "var(--ha-text)", fontSize: 14, lineHeight: 1.4, wordBreak: "break-word" }}>
                                  {name}
                                </span>
                                <StockQuantityCell quantity={Number(row.quantity)} unit={unit} />
                              </div>
                            );
                          })}
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}

              {displayedBalances.length > 0 && filter.trim() && (
                <span style={{ display: "block", marginTop: 10, fontSize: 12, textAlign: "center", color: "var(--ha-text-3)" }}>
                  Mostrando {displayedBalances.length} de {nonzeroBalances.length}
                </span>
              )}
            </>
          )}
        </div>

        <div className="ha-modal__foot">
          <button className="ha-btn ha-btn--primary" onClick={handleClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
