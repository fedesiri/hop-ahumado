"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { PRICE_TYPE_LABELS, PRICE_TYPES, type PriceType } from "@/lib/order-calculator/price-types";
import { toast } from "@/lib/toast";
import type { OperationalParameters } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { Spinner } from "@/components/spinner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function pctToInput(v: number): string {
  return String(Math.round(v * 1000) / 10);
}

export default function OperationalParametersPage() {
  return <OperationalParametersContent />;
}

function OperationalParametersContent() {
  const { selectedLineId } = useLineContext();
  const [data, setData] = useState<OperationalParameters | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [workDays, setWorkDays] = useState("");
  const [hoursPerShift, setHoursPerShift] = useState("");
  const [capacityHours, setCapacityHours] = useState("");

  const [partnerName, setPartnerName] = useState("");
  const [partnerSalary, setPartnerSalary] = useState("");

  const [fixedCostConcept, setFixedCostConcept] = useState("");
  const [fixedCostValue, setFixedCostValue] = useState("");

  const [editingFixedCostId, setEditingFixedCostId] = useState<string | null>(null);
  const [editFixedCostConcept, setEditFixedCostConcept] = useState("");
  const [editFixedCostValue, setEditFixedCostValue] = useState("");

  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (!selectedLineId) { setData(null); return; }
    setLoading(true);
    try {
      const res = await apiClient.getOperationalParameters(selectedLineId);
      setData(res);
      setWorkDays(String(res.workDaysPerMonth));
      setHoursPerShift(String(res.hoursPerShift));
      setCapacityHours(String(res.capacityHoursPerMonth));
    } catch {
      toast.error("Error al cargar parámetros operativos");
    } finally {
      setLoading(false);
    }
  }, [selectedLineId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const saveCapacity = async () => {
    if (!selectedLineId) return;
    setSaving(true);
    try {
      await apiClient.updateOperationalParameters({
        businessLineId: selectedLineId,
        workDaysPerMonth: workDays ? Number(workDays) : undefined,
        hoursPerShift: hoursPerShift ? Number(hoursPerShift) : undefined,
        capacityHoursPerMonth: capacityHours ? Number(capacityHours) : undefined,
      });
      toast.success("Capacidad actualizada");
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar la capacidad"));
    } finally {
      setSaving(false);
    }
  };

  const addPartner = async () => {
    if (!selectedLineId) return;
    const salary = Number(partnerSalary);
    if (!partnerName.trim() || !Number.isFinite(salary) || salary < 0) { toast.error("Completá nombre y sueldo válidos"); return; }
    try {
      await apiClient.addOperationalPartner({ businessLineId: selectedLineId, name: partnerName.trim(), monthlySalary: salary });
      setPartnerName(""); setPartnerSalary("");
      toast.success("Socio agregado");
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al agregar socio"));
    }
  };

  const togglePartnerActive = async (id: string, active: boolean) => {
    try {
      await apiClient.updateOperationalPartner(id, { active });
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar socio"));
    }
  };

  const removePartner = async (id: string) => {
    try {
      await apiClient.removeOperationalPartner(id);
      toast.success("Socio eliminado");
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar socio"));
    }
  };

  const addFixedCost = async () => {
    if (!selectedLineId) return;
    const value = Number(fixedCostValue);
    if (!fixedCostConcept.trim() || !Number.isFinite(value) || value < 0) { toast.error("Completá concepto y monto válidos"); return; }
    try {
      await apiClient.addFixedCostItem({ businessLineId: selectedLineId, concept: fixedCostConcept.trim(), monthlyCost: value });
      setFixedCostConcept(""); setFixedCostValue("");
      toast.success("Costo fijo agregado");
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al agregar costo fijo"));
    }
  };

  const toggleFixedCostActive = async (id: string, active: boolean) => {
    try {
      await apiClient.updateFixedCostItem(id, { active });
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar costo fijo"));
    }
  };

  const startEditFixedCost = (id: string, concept: string, monthlyCost: number) => {
    setEditingFixedCostId(id);
    setEditFixedCostConcept(concept);
    setEditFixedCostValue(String(monthlyCost));
  };

  const cancelEditFixedCost = () => {
    setEditingFixedCostId(null);
    setEditFixedCostConcept("");
    setEditFixedCostValue("");
  };

  const saveEditFixedCost = async () => {
    if (!editingFixedCostId) return;
    const value = Number(editFixedCostValue);
    if (!editFixedCostConcept.trim() || !Number.isFinite(value) || value < 0) { toast.error("Completá concepto y monto válidos"); return; }
    try {
      await apiClient.updateFixedCostItem(editingFixedCostId, { concept: editFixedCostConcept.trim(), monthlyCost: value });
      toast.success("Costo fijo actualizado");
      cancelEditFixedCost();
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar costo fijo"));
    }
  };

  const removeFixedCost = async (id: string) => {
    try {
      await apiClient.removeFixedCostItem(id);
      toast.success("Costo fijo eliminado");
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar costo fijo"));
    }
  };

  const saveCommission = async (channel: PriceType) => {
    if (!selectedLineId) return;
    const raw = commissionDrafts[channel];
    const pct = Number(raw);
    if (!raw || !Number.isFinite(pct) || pct < 0 || pct > 100) { toast.error("Ingresá un porcentaje válido (0-100)"); return; }
    try {
      await apiClient.upsertChannelCommission({ businessLineId: selectedLineId, channel, commissionPct: pct / 100 });
      setCommissionDrafts((prev) => ({ ...prev, [channel]: "" }));
      toast.success("Comisión actualizada");
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar la comisión"));
    }
  };

  if (!selectedLineId) {
    return <EmptyState title="Seleccioná una línea de negocio" style={{ marginTop: 48 }} />;
  }

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Parámetros operativos</h1>
      </div>

      <ScreenInfoPanel title="¿Cómo se usa esta pantalla? Tocá acá para verlo">
        <div>
          <p style={{ margin: "0 0 8px 0" }}>
            Acá anotás la plata que gastás todos los meses, aunque no sea para comprar ingredientes: los sueldos de los socios, el alquiler, la luz.
          </p>
          <p style={{ margin: "0 0 10px 0" }}>
            El sistema usa estos números para saber cuánto cuesta una hora de trabajo. Ese costo se suma después a cada receta.
          </p>

          <p style={{ margin: "0 0 6px 0", fontWeight: 600 }}>Arriba de todo — Capacidad:</p>
          <ol style={{ margin: "0 0 10px 0", paddingLeft: 20 }}>
            <li>Escribí cuántos días trabajan por mes.</li>
            <li>Escribí cuántas horas trabajan por día.</li>
            <li>Escribí cuántas horas en total hay disponibles en el mes (ese número no se calcula solo, lo decidís vos).</li>
            <li>Tocá <strong>Guardar capacidad</strong>.</li>
          </ol>

          <p style={{ margin: "0 0 6px 0", fontWeight: 600 }}>Más abajo — Socios:</p>
          <ol style={{ margin: "0 0 10px 0", paddingLeft: 20 }}>
            <li>Al pie de la tabla, escribí el nombre del socio y su sueldo del mes.</li>
            <li>Tocá <strong>+ Agregar</strong>.</li>
            <li>Si un socio no cobró ese mes, destildá el casillero de <strong>Activo</strong> de su fila (no hace falta borrarlo).</li>
          </ol>

          <p style={{ margin: "0 0 6px 0", fontWeight: 600 }}>Costos fijos mensuales:</p>
          <ol style={{ margin: "0 0 10px 0", paddingLeft: 20 }}>
            <li>Es lo mismo que Socios, pero para gastos como el alquiler, la luz, el marketing.</li>
            <li>Escribí el nombre del gasto y cuánto sale por mes, tocá <strong>+ Agregar</strong>.</li>
            <li>Si un gasto hoy no se paga, destildá <strong>Activo</strong> en esa fila. Podés volver a tildarlo el día que empiece a pagarse.</li>
          </ol>

          <p style={{ margin: "0 0 6px 0", fontWeight: 600 }}>Comisiones por canal:</p>
          <p style={{ margin: 0 }}>
            Dejalo en 0% si todavía cobrás en efectivo o transferencia. El día que empieces a cobrar con Mercado Pago o tarjeta, escribí ahí el porcentaje que te cobran y tocá <strong>Guardar</strong> en esa fila — los precios de venta se ajustan solos.
          </p>
        </div>
      </ScreenInfoPanel>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          {/* Capacidad */}
          <div className="rc-card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="rc-card__title" style={{ marginBottom: 12 }}>Capacidad</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="ha-field">
                <label className="ha-label">Jornadas de trabajo/mes</label>
                <input type="number" className="ha-input" min={0} step={1} value={workDays} onChange={(e) => setWorkDays(e.target.value)} />
              </div>
              <div className="ha-field">
                <label className="ha-label">Horas promedio/jornada</label>
                <input type="number" className="ha-input" min={0} step={0.5} value={hoursPerShift} onChange={(e) => setHoursPerShift(e.target.value)} />
              </div>
              <div className="ha-field">
                <label className="ha-label">Horas-hombre disponibles/mes</label>
                <input type="number" className="ha-input" min={0} step={1} value={capacityHours} onChange={(e) => setCapacityHours(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button className="ha-btn ha-btn--primary" onClick={() => void saveCapacity()} disabled={saving}>
                {saving ? "Guardando…" : "Guardar capacidad"}
              </button>
            </div>
          </div>

          {/* Socios */}
          <div className="rc-card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="rc-card__title" style={{ marginBottom: 12 }}>Mano de obra — socios</div>
            <div className="ps-tablewrap">
              <table className="rc-table">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>Sueldo/mes</th>
                    <th>Activo</th>
                    <th style={{ width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {data.partners.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{formatCurrency(p.monthlySalary)}</td>
                      <td>
                        <input type="checkbox" checked={p.active} onChange={(e) => void togglePartnerActive(p.id, e.target.checked)} />
                      </td>
                      <td>
                        <button className="rc-xbtn" onClick={() => void removePartner(p.id)} aria-label="Eliminar socio">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rc-addrow" style={{ marginTop: 12 }}>
              <div className="rc-ff" style={{ flex: 2 }}>
                <label>Nombre</label>
                <input className="rc-finput" style={{ width: "100%" }} placeholder="Ej: Socio 5" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
              </div>
              <div className="rc-ff" style={{ width: 140 }}>
                <label>Sueldo/mes</label>
                <input type="number" className="rc-finput" style={{ width: "100%" }} min={0} step={1000} value={partnerSalary} onChange={(e) => setPartnerSalary(e.target.value)} />
              </div>
              <button className="pc-btn pc-btn--primary" style={{ height: 40, alignSelf: "flex-end" }} onClick={() => void addPartner()}>
                <Plus size={14} /> Agregar
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--ha-text-2)" }}>
              Total sueldos activos: <b>{formatCurrency(data.rates.totalActiveSalaries)}</b> · Tarifa mano de obra/hora: <b>{formatCurrency(data.rates.laborRatePerHour)}</b>
            </div>
          </div>

          {/* Costos fijos */}
          <div className="rc-card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="rc-card__title" style={{ marginBottom: 12 }}>Costos fijos mensuales</div>
            <div className="ps-tablewrap">
              <table className="rc-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Costo/mes</th>
                    <th>Activo</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {data.fixedCosts.map((f) => {
                    const isEditing = editingFixedCostId === f.id;
                    return (
                      <tr key={f.id}>
                        <td>
                          {isEditing ? (
                            <input className="rc-finput" style={{ width: "100%" }} value={editFixedCostConcept} onChange={(e) => setEditFixedCostConcept(e.target.value)} />
                          ) : (
                            f.concept
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input type="number" className="rc-finput" style={{ width: 140 }} min={0} step={1000} value={editFixedCostValue} onChange={(e) => setEditFixedCostValue(e.target.value)} />
                          ) : (
                            formatCurrency(f.monthlyCost)
                          )}
                        </td>
                        <td>
                          <input type="checkbox" checked={f.active} onChange={(e) => void toggleFixedCostActive(f.id, e.target.checked)} />
                        </td>
                        <td style={{ display: "flex", gap: 4 }}>
                          {isEditing ? (
                            <>
                              <button className="rc-xbtn" onClick={() => void saveEditFixedCost()} aria-label="Guardar costo fijo">
                                <Check size={14} />
                              </button>
                              <button className="rc-xbtn" onClick={cancelEditFixedCost} aria-label="Cancelar edición">
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="rc-xbtn" onClick={() => startEditFixedCost(f.id, f.concept, f.monthlyCost)} aria-label="Editar costo fijo">
                                <Pencil size={14} />
                              </button>
                              <button className="rc-xbtn" onClick={() => void removeFixedCost(f.id)} aria-label="Eliminar costo fijo">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rc-addrow" style={{ marginTop: 12 }}>
              <div className="rc-ff" style={{ flex: 2 }}>
                <label>Concepto</label>
                <input className="rc-finput" style={{ width: "100%" }} placeholder="Ej: Alquiler" value={fixedCostConcept} onChange={(e) => setFixedCostConcept(e.target.value)} />
              </div>
              <div className="rc-ff" style={{ width: 140 }}>
                <label>Costo/mes</label>
                <input type="number" className="rc-finput" style={{ width: "100%" }} min={0} step={1000} value={fixedCostValue} onChange={(e) => setFixedCostValue(e.target.value)} />
              </div>
              <button className="pc-btn pc-btn--primary" style={{ height: 40, alignSelf: "flex-end" }} onClick={() => void addFixedCost()}>
                <Plus size={14} /> Agregar
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--ha-text-2)" }}>
              Total costos fijos activos: <b>{formatCurrency(data.rates.totalActiveFixedCosts)}</b> · Tarifa costos fijos/hora: <b>{formatCurrency(data.rates.fixedCostRatePerHour)}</b>
            </div>
          </div>

          {/* Comisiones por canal */}
          <div className="rc-card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="rc-card__title" style={{ marginBottom: 12 }}>Comisiones por canal</div>
            <div className="ps-tablewrap">
              <table className="rc-table">
                <thead>
                  <tr>
                    <th>Canal</th>
                    <th>Comisión actual</th>
                    <th>Nueva comisión (%)</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {PRICE_TYPES.map((channel) => {
                    const existing = data.channelCommissions.find((c) => c.channel === channel);
                    return (
                      <tr key={channel}>
                        <td>{PRICE_TYPE_LABELS[channel]}</td>
                        <td>{existing ? `${pctToInput(existing.commissionPct)}%` : "0%"}</td>
                        <td>
                          <input
                            type="number"
                            className="rc-finput"
                            style={{ width: 100 }}
                            min={0}
                            max={100}
                            step={0.1}
                            placeholder="0"
                            value={commissionDrafts[channel] ?? ""}
                            onChange={(e) => setCommissionDrafts((prev) => ({ ...prev, [channel]: e.target.value }))}
                          />
                        </td>
                        <td>
                          <button className="pc-btn pc-btn--ghost pc-btn--sm" onClick={() => void saveCommission(channel)}>Guardar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen */}
          <div className="rc-card" style={{ padding: 20 }}>
            <div className="rc-card__title" style={{ marginBottom: 12 }}>Estructura mensual</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <div className="rc-resrow"><span className="rc-resrow__n">Tarifa operativa/hora</span><span className="rc-resrow__v">{formatCurrency(data.rates.totalOperativeRatePerHour)}</span></div>
              <div className="rc-resrow"><span className="rc-resrow__n"><b>Estructura mensual total</b></span><span className="rc-resrow__v"><b>{formatCurrency(data.rates.monthlyStructureTotal)}</b></span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
