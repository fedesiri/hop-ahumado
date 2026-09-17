"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { ProductionPlan, ProductionPlanSummary, RecipeCostProfile } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { useCallback, useEffect, useMemo, useState } from "react";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ProductionPlanPage() {
  return <ProductionPlanContent />;
}

function ProductionPlanContent() {
  const { selectedLineId } = useLineContext();
  const [month, setMonth] = useState(currentMonth());
  const [recipes, setRecipes] = useState<RecipeCostProfile[]>([]);
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [summary, setSummary] = useState<ProductionPlanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    if (!selectedLineId) return;
    setLoading(true);
    try {
      const [recipesRes, planRes, summaryRes] = await Promise.all([
        apiClient.getRecipeCostProfiles(1, 100, selectedLineId),
        apiClient.getProductionPlan(selectedLineId, month),
        apiClient.getProductionPlanSummary(selectedLineId, month),
      ]);
      setRecipes(recipesRes.data);
      setPlan(planRes);
      setSummary(summaryRes);
      const nextDrafts: Record<string, string> = {};
      for (const line of planRes.lines) nextDrafts[line.productId] = String(line.batchesPerMonth);
      setDrafts(nextDrafts);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar el plan de producción"));
    } finally {
      setLoading(false);
    }
  }, [selectedLineId, month]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const saveLine = async (productId: string) => {
    if (!selectedLineId) return;
    const raw = drafts[productId] ?? "0";
    const batches = Number(raw);
    if (!Number.isFinite(batches) || batches < 0) { toast.error("Ingresá un número de tandas válido"); return; }
    try {
      await apiClient.upsertProductionPlanLine(productId, { businessLineId: selectedLineId, month, batchesPerMonth: batches });
      const summaryRes = await apiClient.getProductionPlanSummary(selectedLineId, month);
      setSummary(summaryRes);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar las tandas"));
    }
  };

  const summaryByProductId = useMemo(() => {
    const map = new Map<string, ProductionPlanSummary["lines"][number]>();
    for (const line of summary?.lines ?? []) map.set(line.productId, line);
    return map;
  }, [summary]);

  const resultadoPositivo = (summary?.resultadoEstimado ?? 0) >= 0;

  if (!selectedLineId) {
    return <div className="ha-empty" style={{ marginTop: 48 }}><p className="ha-empty__t">Seleccioná una línea de negocio</p></div>;
  }

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Plan de producción</h1>
        <input
          type="month"
          className="ha-filter-input"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonth())}
        />
      </div>

      {loading || !plan ? (
        <Spinner />
      ) : (
        <>
          <div className="rc-card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="rc-card__title" style={{ marginBottom: 12 }}>Tandas del mes</div>
            <div className="ps-tablewrap">
              <table className="rc-table">
                <thead>
                  <tr>
                    <th>Receta</th>
                    <th>Tandas/mes</th>
                    <th>Horas-hombre</th>
                    <th>Unidades producidas</th>
                    <th>Materia prima propia</th>
                    <th>Ingreso estimado (minorista)</th>
                    <th>Margen de contribución</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {recipes.map((r) => {
                    const line = summaryByProductId.get(r.productId);
                    return (
                      <tr key={r.productId}>
                        <td>{r.product?.name ?? "—"}</td>
                        <td>
                          <input
                            type="number"
                            className="rc-finput"
                            style={{ width: 80 }}
                            min={0}
                            step={0.5}
                            value={drafts[r.productId] ?? ""}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [r.productId]: e.target.value }))}
                          />
                        </td>
                        <td>{line ? formatQuantity(line.horasHombreTotales) : "—"}</td>
                        <td>{line ? formatQuantity(line.unidadesProducidas) : "—"}</td>
                        <td>{line ? formatCurrency(line.materiaPrimaPropia) : "—"}</td>
                        <td>{line ? formatCurrency(line.ingresoEstimado) : "—"}</td>
                        <td>{line ? formatCurrency(line.margenContribucion) : "—"}</td>
                        <td>
                          <button className="pc-btn pc-btn--ghost pc-btn--sm" onClick={() => void saveLine(r.productId)}>Guardar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {summary && (
            <div className="rc-card" style={{ padding: 20 }}>
              <div className="rc-card__title" style={{ marginBottom: 12 }}>¿Alcanza? — Absorción de estructura y punto de equilibrio</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                <div className="rc-resrow"><span className="rc-resrow__n">Horas-hombre del plan</span><span className="rc-resrow__v">{formatQuantity(summary.horasHombreDelPlan)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Capacidad disponible/mes</span><span className="rc-resrow__v">{formatQuantity(summary.capacidadHorasMes)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">% de capacidad usada</span><span className="rc-resrow__v">{pct(summary.pctCapacidadUsada)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Estructura mensual</span><span className="rc-resrow__v">{formatCurrency(summary.estructuraMensual)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Estructura absorbida</span><span className="rc-resrow__v">{formatCurrency(summary.estructuraAbsorbida)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Estructura no recuperada</span><span className="rc-resrow__v">{formatCurrency(summary.estructuraNoRecuperada)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Ingreso estimado del plan</span><span className="rc-resrow__v">{formatCurrency(summary.ingresoEstimadoTotal)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Margen de contribución %</span><span className="rc-resrow__v">{pct(summary.margenContribucionPct)}</span></div>
                <div className="rc-resrow"><span className="rc-resrow__n">Ingreso necesario de equilibrio</span><span className="rc-resrow__v">{summary.ingresoNecesarioEquilibrio != null ? formatCurrency(summary.ingresoNecesarioEquilibrio) : "—"}</span></div>
              </div>
              <div
                style={{
                  marginTop: 16, padding: 12, borderRadius: 8,
                  background: resultadoPositivo ? "var(--ha-green-soft)" : "var(--ha-red-soft)",
                  color: resultadoPositivo ? "var(--ha-green)" : "var(--ha-red)",
                  fontWeight: 600,
                }}
              >
                {resultadoPositivo ? "✅" : "🔴"} Resultado estimado del mes: {formatCurrency(summary.resultadoEstimado)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
