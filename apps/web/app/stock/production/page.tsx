"use client";

import { apiClient } from "@/lib/api-client";
import { formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { Product, ProductionTemplate } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { useEffect, useMemo, useState } from "react";

const UNIT: Record<string, string> = { UNIT: "un", KG: "kg", G: "g", L: "L", ML: "ml" };

/** Número con hasta 4 decimales, como texto editable (sin ceros de más). */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10000) / 10000);
}

function num(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Cantidad sospechosa: en kg/L, 200 o más casi siempre es un valor cargado en gramos/ml. */
const SUSPICIOUS = 200;
function isSuspicious(unit: string, qty: number): boolean {
  return (unit === "KG" || unit === "L") && qty >= SUSPICIOUS;
}

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface Line {
  productId: string;
  name: string;
  unit: string;
  stock: number;
  perUnit: number;
  extra?: boolean;
}

export default function ProductionPage() {
  const { selectedLineId } = useLineContext();
  const [templates, setTemplates] = useState<ProductionTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templateId, setTemplateId] = useState("");
  const [rawQty, setRawQty] = useState("");
  const [outInput, setOutInput] = useState<string | null>(null); // null = automático
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Line[]>([]);
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!selectedLineId) return;
    try {
      setLoading(true);
      const [t, p] = await Promise.all([
        apiClient.getProductionTemplates(selectedLineId),
        apiClient.getProducts(1, 100, false, undefined, undefined, selectedLineId),
      ]);
      setTemplates(t);
      setProducts(p.data);
    } catch {
      toast.error("No se pudieron cargar las recetas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedLineId]);

  const template = templates.find((t) => t.id === templateId) ?? null;

  const reset = () => {
    setRawQty("");
    setOutInput(null);
    setOverrides({});
    setRemoved(new Set());
    setExtras([]);
    setNotes("");
  };

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    reset();
  };

  // Preparación que se arma a partir de una base (ej. relleno): se carga cuánta base hay y el resto se calcula.
  const driver = template?.driverIngredientId ? template.items.find((i) => i.productId === template.driverIngredientId) ?? null : null;

  // Cantidad producida: en cocción sale de la cruda menos la merma (editable); si no, la que cargues.
  const outQty = useMemo(() => {
    if (!template) return 0;
    if (outInput !== null) return num(outInput);
    if (template.isCooking) return num(rawQty) * (1 - template.cookingLossPct);
    if (driver && driver.perUnit > 0) return num(rawQty) / driver.perUnit;
    return 0;
  }, [template, outInput, rawQty, driver]);

  const lines: (Line & { qty: number })[] = useMemo(() => {
    if (!template) return [];
    const base: Line[] = [...template.items.map((i) => ({ ...i })), ...extras];
    return base
      .filter((l) => !removed.has(l.productId))
      .map((l) => {
        let auto = l.perUnit * outQty;
        if (template.isCooking && l.productId === template.mainIngredientId) auto = num(rawQty);
        if (driver && l.productId === driver.productId) auto = num(rawQty);
        const qty = overrides[l.productId] !== undefined ? num(overrides[l.productId]) : auto;
        return { ...l, qty };
      });
  }, [template, extras, removed, overrides, outQty, rawQty, driver]);

  const realLoss = template?.isCooking && num(rawQty) > 0 && outQty > 0 ? 1 - outQty / num(rawQty) : null;
  const suspiciousNames = [
    ...(template && isSuspicious(template.unit, outQty) ? [template.name] : []),
    ...lines.filter((l) => isSuspicious(l.unit, l.qty)).map((l) => l.name),
  ];
  const canSave = !!template && outQty > 0 && lines.some((l) => l.qty > 0) && !saving;

  const addable = products.filter(
    (p) => !!template && p.id !== template.id && !p.deactivationDate && !lines.some((l) => l.productId === p.id),
  );

  const submit = async () => {
    if (!template || !canSave) return;
    if (suspiciousNames.length > 0 && !window.confirm(`Revisá las cantidades: ${suspiciousNames.join(", ")}. ¿Están en kg/litros y no en gramos/ml? ¿Registrar igual?`)) return;
    try {
      setSaving(true);
      await apiClient.createProduction({
        productId: template.id,
        quantity: Math.round(outQty * 10000) / 10000,
        inputs: lines.filter((l) => l.qty > 0).map((l) => ({ productId: l.productId, quantity: Math.round(l.qty * 10000) / 10000 })),
        date,
        notes: notes.trim() || undefined,
      });
      toast.success(`Producción registrada: ${fmt(outQty)} ${UNIT[template.unit] ?? ""} de ${template.name}`);
      reset();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la producción");
    } finally {
      setSaving(false);
    }
  };

  if (loading && templates.length === 0) return <Spinner />;

  const mainName = template?.items.find((i) => i.productId === template.mainIngredientId)?.name;
  const unitLabel = template ? (UNIT[template.unit] ?? "") : "";

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="ha-pagetitle">Producción</h1>
      <p className="ha-pagesub">Registrá una cocción o un envasado: se descuentan los insumos y se suma lo que salió.</p>

      <div className="ha-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="ha-field">
          <label className="ha-label">¿Qué producís?</label>
          <select className="ha-select" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">Elegí un producto…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (stock {formatQuantity(t.stock)} {UNIT[t.unit] ?? ""})
              </option>
            ))}
          </select>
        </div>

        {template && (
          <>
            {template.isCooking ? (
              <>
                <div className="ha-field">
                  <label className="ha-label">Kg de {mainName ?? "carne cruda"} que cocinaste</label>
                  <input
                    className="ha-input"
                    inputMode="decimal"
                    placeholder="Ej: 10"
                    value={rawQty}
                    onChange={(e) => setRawQty(e.target.value)}
                  />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Kg que salieron de la cocción (real)</label>
                  <input
                    className="ha-input"
                    inputMode="decimal"
                    placeholder="Se calcula solo, podés corregirlo"
                    value={outInput ?? (outQty > 0 ? fmt(outQty) : "")}
                    onChange={(e) => setOutInput(e.target.value)}
                  />
                  <div style={{ fontSize: 13, color: "var(--ha-text-2)", marginTop: 6 }}>
                    Guía: merma de {Math.round(template.cookingLossPct * 100)}%.
                    {realLoss !== null && <> Merma real de esta tanda: <b>{Math.round(realLoss * 100)}%</b>.</>}
                    {outInput !== null && (
                      <>
                        {" "}
                        <button className="ha-btn ha-btn--secondary" style={{ height: 28, padding: "0 10px" }} onClick={() => setOutInput(null)}>
                          Volver al cálculo automático
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : driver ? (
              <>
                <div className="ha-field">
                  <label className="ha-label">Kg de {driver.name} que vas a usar</label>
                  <input
                    className="ha-input"
                    inputMode="decimal"
                    placeholder="Ej: 3"
                    value={rawQty}
                    onChange={(e) => setRawQty(e.target.value)}
                  />
                </div>
                <div className="ha-field">
                  <label className="ha-label">{template.name} que salen ({unitLabel}, real)</label>
                  <input
                    className="ha-input"
                    inputMode="decimal"
                    placeholder="Se calcula solo, podés corregirlo"
                    value={outInput ?? (outQty > 0 ? fmt(outQty) : "")}
                    onChange={(e) => setOutInput(e.target.value)}
                  />
                  <div style={{ fontSize: 13, color: "var(--ha-text-2)", marginTop: 6 }}>
                    Los demás insumos se calculan a partir de la base.
                    {outInput !== null && (
                      <>
                        {" "}
                        <button className="ha-btn ha-btn--secondary" style={{ height: 28, padding: "0 10px" }} onClick={() => setOutInput(null)}>
                          Volver al cálculo automático
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="ha-field">
                <label className="ha-label">Cantidad que producís ({unitLabel})</label>
                <input
                  className="ha-input"
                  inputMode="decimal"
                  placeholder="Ej: 5"
                  value={outInput ?? ""}
                  onChange={(e) => setOutInput(e.target.value)}
                />
              </div>
            )}

            <div>
              <div className="ha-label">Insumos que se descuentan</div>
              {lines.length === 0 && <div style={{ fontSize: 13, color: "var(--ha-text-2)" }}>Cargá la cantidad para ver los insumos.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lines.map((l) => {
                  const short = l.qty > l.stock + 1e-9;
                  return (
                    <div
                      key={l.productId}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--ha-border)" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{l.name}</div>
                        <div style={{ fontSize: 12, color: short ? "var(--ha-red)" : "var(--ha-text-3)" }}>
                          En stock: {formatQuantity(l.stock)} {UNIT[l.unit] ?? ""}
                          {short ? " · no alcanza" : ""}
                        </div>
                      </div>
                      <input
                        className="ha-input"
                        style={{ width: 96, textAlign: "right" }}
                        inputMode="decimal"
                        value={overrides[l.productId] ?? (l.qty > 0 ? fmt(l.qty) : "")}
                        onChange={(e) => setOverrides((o) => ({ ...o, [l.productId]: e.target.value }))}
                        aria-label={`Cantidad de ${l.name}`}
                      />
                      <span style={{ width: 24, fontSize: 12, color: "var(--ha-text-2)" }}>{UNIT[l.unit] ?? ""}</span>
                      <button
                        className="ha-iconbtn"
                        aria-label={`Quitar ${l.name}`}
                        onClick={() => setRemoved((r) => new Set(r).add(l.productId))}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              {addable.length > 0 && (
                <select
                  className="ha-select"
                  style={{ marginTop: 10 }}
                  value=""
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    if (!p) return;
                    setRemoved((r) => {
                      const n = new Set(r);
                      n.delete(p.id);
                      return n;
                    });
                    setExtras((x) => [...x, { productId: p.id, name: p.name, unit: p.unit, stock: p.stock, perUnit: 0, extra: true }]);
                  }}
                >
                  <option value="">＋ Agregar otro insumo…</option>
                  {addable.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="ha-field" style={{ flex: "1 1 160px" }}>
                <label className="ha-label">Fecha</label>
                <input className="ha-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="ha-field" style={{ flex: "2 1 220px" }}>
                <label className="ha-label">Nota (opcional)</label>
                <input className="ha-input" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            {suspiciousNames.length > 0 && (
              <div style={{ fontSize: 13, color: "var(--ha-red)", background: "var(--ha-surface-2, transparent)", padding: "8px 10px", border: "1px solid var(--ha-red)", borderRadius: 8 }}>
                ⚠ Cantidad muy grande en {suspiciousNames.join(", ")}. Acá se carga en <b>kg o litros</b> (3,1 y no 3100). Revisalo antes de registrar.
              </div>
            )}
            <div style={{ fontSize: 14 }}>
              Va a sumar <b>{fmt(outQty) || 0} {unitLabel}</b> de <b>{template.name}</b>.
            </div>
            <button className="ha-btn ha-btn--primary" style={{ height: 48 }} disabled={!canSave} onClick={() => void submit()}>
              {saving ? "Registrando…" : "Registrar producción"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
