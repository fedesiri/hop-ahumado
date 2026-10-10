"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { Spinner } from "@/components/spinner";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type {
  CashFlowConfig,
  CashMovement,
  CashMovementInput,
  CashMovementStatus,
  CashMovementType,
  CashSummary,
} from "@/lib/types";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Tab = "summary" | "movements" | "cash";

const PAGE_SIZE = 50;
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const todayStr = () => new Date().toLocaleDateString("en-CA");
const formatDay = (iso: string) => iso.split("-").reverse().join("/");

export default function CashFlowPage() {
  const { selectedLineId } = useLineContext();
  const [tab, setTab] = useState<Tab>("summary");
  const [config, setConfig] = useState<CashFlowConfig | null>(null);
  // Se incrementa cuando cambia algún dato, para que las otras pestañas recarguen.
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    apiClient.getCashFlowConfig().then(setConfig).catch(() => toast.error("Error al cargar la configuración"));
  }, []);

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Flujo de caja</h1>
      </div>

      <ScreenInfoPanel title="¿Cómo se usa esta pantalla? Tocá acá para verlo">
        <div>
          <p style={{ margin: "0 0 8px 0" }}>
            Acá se anota toda la plata que entra (ventas) y toda la plata que sale (compras de insumos, servicios, equipamiento).
          </p>
          <ol style={{ margin: "0 0 8px 0", paddingLeft: 20 }}>
            <li><strong>Resumen:</strong> muestra cuánto entró, cuánto salió y cuánto quedó. Podés elegir un mes y un año.</li>
            <li><strong>Movimientos:</strong> la lista de cada ingreso y egreso. Tocá <strong>+ Nuevo movimiento</strong> para anotar uno. Si algo estaba pendiente y ya se cobró o se pagó, tocá el tilde verde de esa fila; no hace falta cargarlo de nuevo.</li>
            <li><strong>Caja y deudas:</strong> acá actualizás cuánta plata hay hoy en efectivo y en Mercado Pago, y ves cuánto hay que devolverle a cada socio.</li>
          </ol>
          <p style={{ margin: 0 }}>
            <strong>Inversión</strong> (por ejemplo, comprar un horno) se muestra aparte de los gastos de todos los días, para no distorsionar el resultado del mes.
          </p>
        </div>
      </ScreenInfoPanel>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {([["summary", "Resumen"], ["movements", "Movimientos"], ["cash", "Caja y deudas"]] as const).map(([key, label]) => (
          <button
            key={key}
            className={`ha-btn ${tab === key ? "ha-btn--primary" : "ha-btn--secondary"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {!selectedLineId || !config ? (
        <Spinner />
      ) : tab === "summary" ? (
        <SummaryTab lineId={selectedLineId} version={version} />
      ) : tab === "movements" ? (
        <MovementsTab lineId={selectedLineId} config={config} onChanged={bump} />
      ) : (
        <CashTab lineId={selectedLineId} version={version} onChanged={bump} />
      )}
    </div>
  );
}

// ── Resumen ────────────────────────────────────────────────────────────────

function SummaryTab({ lineId, version }: { lineId: string; version: number }) {
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [data, setData] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getCashFlowSummary(lineId, year, month)
      .then((d) => !cancelled && setData(d))
      .catch(() => toast.error("Error al cargar el resumen"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lineId, year, month, version]);

  const currentYear = new Date().getFullYear();
  const negative = (n: number) => (n < 0 ? "var(--ha-red)" : "var(--ha-green)");

  return (
    <div>
      <div className="pc-filter" style={{ marginBottom: 16 }}>
        <select className="ha-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          <option value={0}>Todos los meses</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select className="ha-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          <option value={0}>Todo el historial</option>
          {[currentYear, currentYear - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          {data.reviewCount > 0 && (
            <p style={{ margin: "0 0 16px 0", padding: "8px 10px", background: "var(--ha-red-soft)", borderRadius: 6, color: "var(--ha-red)" }}>
              Hay {data.reviewCount} movimiento(s) marcados para revisar. Filtralos en <strong>Movimientos</strong> con &quot;Solo a revisar&quot;.
            </p>
          )}
          <div className="me-kpis" style={{ marginBottom: 16 }}>
            <Kpi label="Ingresos" value={data.income} color="var(--ha-green)" />
            <Kpi label="Gastos operativos" value={data.operatingExpense} />
            <Kpi label="Margen operativo" value={data.operatingResult} color={negative(data.operatingResult)} sub={data.operatingMarginPct === null ? undefined : `${data.operatingMarginPct.toFixed(1)}%`} />
            <Kpi label="Inversión (equipamiento)" value={data.investmentExpense} />
            <Kpi label="Resultado total" value={data.totalResult} color={negative(data.totalResult)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
            <CategoryTable title="Ingresos por categoría" rows={data.incomeByCategory} total={data.income} />
            <CategoryTable title="Gastos por categoría" rows={data.expenseByCategory} total={data.operatingExpense + data.investmentExpense} />
          </div>

          <div className="pc-card">
            <h2 style={{ margin: "12px 16px 0", fontSize: 15 }}>Evolución mensual {data.monthlyYear}</h2>
            <div className="pc-tablewrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Mes</th><th>Ingresos</th><th>Gastos operativos</th><th>Inversión</th><th>Resultado operativo</th><th>Resultado total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => (
                    <tr key={m.month}>
                      <td>{m.label}</td>
                      <td>{formatCurrency(m.income)}</td>
                      <td>{formatCurrency(m.operatingExpense)}</td>
                      <td>{formatCurrency(m.investmentExpense)}</td>
                      <td style={{ color: negative(m.operatingResult) }}>{formatCurrency(m.operatingResult)}</td>
                      <td style={{ color: negative(m.totalResult) }}>{formatCurrency(m.totalResult)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: string }) {
  return (
    <div className="me-kpi">
      <div className="me-kpi__label">{label}</div>
      <div className="me-kpi__val" style={color ? { color } : undefined}>{formatCurrency(value)}</div>
      {sub && <div className="me-kpi__label">{sub}</div>}
    </div>
  );
}

function CategoryTable({ title, rows, total }: { title: string; rows: CashSummary["incomeByCategory"]; total: number }) {
  return (
    <div className="pc-card">
      <h2 style={{ margin: "12px 16px 0", fontSize: 15 }}>{title}</h2>
      <div className="pc-tablewrap">
        <table className="pc-table">
          <thead>
            <tr><th>Categoría</th><th>Monto</th><th>%</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <td>{r.category}{r.classification === "INVESTMENT" ? " (inversión)" : ""}</td>
                <td>{formatCurrency(r.amount)}</td>
                <td>{total ? `${((r.amount / total) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="ex-foot"><td>Total</td><td>{formatCurrency(total)}</td><td /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Movimientos ────────────────────────────────────────────────────────────

type FormState = {
  date: string;
  type: CashMovementType;
  category: string;
  description: string;
  counterparty: string;
  amount: string;
  paymentMethod: string;
  status: CashMovementStatus;
  payer: string;
  reimbursementStatus: string;
  notes: string;
  needsReview: boolean;
};

function MovementsTab({ lineId, config, onChanged }: { lineId: string; config: CashFlowConfig; onChanged: () => void }) {
  const [rows, setRows] = useState<CashMovement[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);

  const [editing, setEditing] = useState<CashMovement | "new" | null>(null);
  const [deleting, setDeleting] = useState<CashMovement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, from, to, type, status, onlyReview]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getCashMovements({
        businessLineId: lineId,
        page,
        limit: PAGE_SIZE,
        from: from || undefined,
        to: to || undefined,
        type: type || undefined,
        status: status || undefined,
        search: debouncedSearch || undefined,
        needsReview: onlyReview || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotals(res.totals);
        setTotal(res.meta.total);
      })
      .catch(() => toast.error("Error al cargar movimientos"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lineId, page, from, to, type, status, debouncedSearch, onlyReview, reload]);

  const changed = () => {
    setReload((r) => r + 1);
    onChanged();
  };

  const settle = async (m: CashMovement) => {
    try {
      await apiClient.updateCashMovement(m.id, { status: "SETTLED" });
      toast.success(m.type === "INCOME" ? "Marcado como cobrado" : "Marcado como pagado");
      changed();
    } catch {
      toast.error("Error al actualizar el movimiento");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await apiClient.deleteCashMovement(deleting.id);
      toast.success("Movimiento eliminado");
      changed();
    } catch {
      toast.error("Error al eliminar el movimiento");
    } finally {
      setDeleting(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="ha-btn ha-btn--primary" onClick={() => setEditing("new")}>
          <Plus size={15} /> Nuevo movimiento
        </button>
      </div>

      <div className="me-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Ingresos (filtro)" value={totals.income} color="var(--ha-green)" />
        <Kpi label="Egresos (filtro)" value={totals.expense} color="var(--ha-red)" />
        <Kpi label="Neto (filtro)" value={totals.income - totals.expense} color={totals.income - totals.expense < 0 ? "var(--ha-red)" : "var(--ha-green)"} />
      </div>

      <div className="pc-filter" style={{ marginBottom: 16 }}>
        <div className="pc-search">
          <Search size={17} />
          <input placeholder="Buscar descripción, cliente o proveedor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" className="ex-date" title="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="ex-date" title="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="ha-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Ingresos y egresos</option>
          <option value="INCOME">Solo ingresos</option>
          <option value="EXPENSE">Solo egresos</option>
        </select>
        <select className="ha-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="SETTLED">Cobrado / Pagado</option>
          <option value="PENDING">Pendiente</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} /> Solo a revisar
        </label>
        <span className="pc-count">{total} movimientos</span>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="ha-empty"><p className="ha-empty__t">Sin movimientos para los filtros aplicados</p></div>
      ) : (
        <div className="pc-card">
          <div className="pc-tablewrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Cliente / Proveedor</th>
                  <th>Monto</th><th>Medio</th><th>Estado</th><th>Pagó / cobró</th><th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="pc-vig">{formatDay(m.date)}</td>
                    <td>{m.type === "INCOME" ? "Ingreso" : "Gasto"}</td>
                    <td>{m.category}</td>
                    <td style={{ fontWeight: 500, maxWidth: 280 }}>
                      {m.description}
                      {m.needsReview && <span className="ha-badge ha-badge--overdue" style={{ marginLeft: 6 }} title={m.notes ?? ""}>revisar</span>}
                    </td>
                    <td>{m.counterparty || "—"}</td>
                    <td>
                      <span className={m.type === "INCOME" ? "ex-cash" : "ex-total"}>
                        {m.type === "EXPENSE" ? "-" : ""}{formatCurrency(m.amount)}
                      </span>
                    </td>
                    <td>{m.paymentMethod || "—"}</td>
                    <td>
                      <span className={`ha-badge ${m.status === "PENDING" ? "ha-badge--pending" : "ha-badge--paid"}`}>
                        {m.status === "PENDING" ? "Pendiente" : m.type === "INCOME" ? "Cobrado" : "Pagado"}
                      </span>
                    </td>
                    <td>
                      {m.payer}
                      {m.payer !== config.defaultPayer && m.reimbursementStatus ? ` (reembolso: ${m.reimbursementStatus})` : ""}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {m.status === "PENDING" && (
                          <button className="pc-btn pc-btn--ghost pc-btn--sm" title="Marcar como cobrado / pagado" onClick={() => void settle(m)}>
                            <Check size={14} />
                          </button>
                        )}
                        <button className="pc-btn pc-btn--ghost pc-btn--sm" title="Editar" onClick={() => setEditing(m)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="pc-btn pc-btn--ghost pc-btn--sm"
                          style={{ color: "var(--ha-red)", borderColor: "var(--ha-red)" }}
                          title="Eliminar"
                          onClick={() => setDeleting(m)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 16 }}>
          <button className="ha-btn ha-btn--secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button className="ha-btn ha-btn--secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
        </div>
      )}

      {editing && (
        <MovementModal
          lineId={lineId}
          config={config}
          movement={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="¿Eliminar movimiento?"
          description={<>Se eliminará <strong>{deleting.description}</strong> ({formatCurrency(deleting.amount)}).</>}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  );
}

function MovementModal({
  lineId,
  config,
  movement,
  onClose,
  onSaved,
}: {
  lineId: string;
  config: CashFlowConfig;
  movement: CashMovement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<FormState>(() => ({
    date: movement?.date ?? todayStr(),
    type: movement?.type ?? "EXPENSE",
    category: movement?.category ?? "",
    description: movement?.description ?? "",
    counterparty: movement?.counterparty ?? "",
    amount: movement ? String(movement.amount) : "",
    paymentMethod: movement?.paymentMethod ?? "",
    status: movement?.status ?? "SETTLED",
    payer: movement?.payer ?? config.defaultPayer,
    reimbursementStatus: movement?.reimbursementStatus ?? "",
    notes: movement?.notes ?? "",
    needsReview: movement?.needsReview ?? false,
  }));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const categories = config.categories.filter((c) => c.type === f.type);
  const thirdParty = f.payer !== config.defaultPayer;

  const submit = async () => {
    const amount = Number(f.amount);
    if (!f.category) return toast.error("Elegí una categoría");
    if (!f.description.trim()) return toast.error("Escribí una descripción");
    if (f.amount === "" || Number.isNaN(amount)) return toast.error("Ingresá un monto válido");
    if (f.status === "SETTLED" && !f.paymentMethod) return toast.error("Elegí el medio de pago, o dejalo como Pendiente");
    const input: CashMovementInput = {
      date: f.date,
      type: f.type,
      category: f.category,
      description: f.description,
      counterparty: f.counterparty,
      amount,
      paymentMethod: f.paymentMethod,
      status: f.status,
      payer: f.payer,
      reimbursementStatus: thirdParty ? f.reimbursementStatus : "",
      notes: f.notes,
      needsReview: f.needsReview,
    };
    setSaving(true);
    try {
      if (movement) await apiClient.updateCashMovement(movement.id, input);
      else await apiClient.createCashMovement(lineId, input);
      toast.success(movement ? "Movimiento actualizado" : "Movimiento registrado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  const income = f.type === "INCOME";

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="ha-modal__head">
          <span className="ha-modal__title">{movement ? "Editar movimiento" : "Nuevo movimiento"}</span>
          <button className="ha-iconbtn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="ha-modal__body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="ha-field">
              <label className="ha-label">Tipo</label>
              <select
                className="ha-select"
                value={f.type}
                onChange={(e) => setF((p) => ({ ...p, type: e.target.value as CashMovementType, category: "" }))}
              >
                <option value="EXPENSE">Gasto (sale plata)</option>
                <option value="INCOME">Ingreso (entra plata)</option>
              </select>
            </div>
            <div className="ha-field">
              <label className="ha-label">Fecha</label>
              <input type="date" className="ha-input" value={f.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="ha-field">
              <label className="ha-label">Categoría</label>
              <select className="ha-select" value={f.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">Elegir…</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}{c.classification === "INVESTMENT" ? " (inversión)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="ha-field">
              <label className="ha-label">Monto ($)</label>
              <input type="number" className="ha-input" step={0.01} value={f.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
          </div>
          <div className="ha-field" style={{ marginTop: 12 }}>
            <label className="ha-label">Descripción</label>
            <input className="ha-input" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="ha-field" style={{ marginTop: 12 }}>
            <label className="ha-label">{income ? "Cliente" : "Proveedor"}</label>
            <input className="ha-input" value={f.counterparty} onChange={(e) => set("counterparty", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div className="ha-field">
              <label className="ha-label">Estado</label>
              <select className="ha-select" value={f.status} onChange={(e) => set("status", e.target.value as CashMovementStatus)}>
                <option value="SETTLED">{income ? "Cobrado" : "Pagado"}</option>
                <option value="PENDING">Pendiente</option>
              </select>
            </div>
            <div className="ha-field">
              <label className="ha-label">Medio de pago</label>
              <select className="ha-select" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                <option value="">—</option>
                {config.paymentMethods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="ha-field">
              <label className="ha-label">{income ? "¿Quién cobró?" : "¿Quién pagó?"}</label>
              <select className="ha-select" value={f.payer} onChange={(e) => set("payer", e.target.value)}>
                {config.payers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {thirdParty && (
              <div className="ha-field">
                <label className="ha-label">¿Alumo ya le devolvió?</label>
                <select className="ha-select" value={f.reimbursementStatus} onChange={(e) => set("reimbursementStatus", e.target.value)}>
                  <option value="">—</option>
                  {config.reimbursementStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="ha-field" style={{ marginTop: 12 }}>
            <label className="ha-label">Observaciones</label>
            <textarea className="ha-input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13 }}>
            <input type="checkbox" checked={f.needsReview} onChange={(e) => set("needsReview", e.target.checked)} /> Marcar para revisar
          </label>
        </div>
        <div className="ha-modal__foot">
          <button className="ha-btn ha-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="ha-btn ha-btn--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Caja y deudas ──────────────────────────────────────────────────────────

function CashTab({ lineId, version, onChanged }: { lineId: string; version: number; onChanged: () => void }) {
  const [data, setData] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState("");
  const [wallet, setWallet] = useState("");
  const [asOf, setAsOf] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getCashFlowSummary(lineId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setCash(d.snapshot ? String(d.snapshot.cash) : "");
        setWallet(d.snapshot ? String(d.snapshot.wallet) : "");
      })
      .catch(() => toast.error("Error al cargar la caja"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lineId, version]);

  const save = async () => {
    const c = Number(cash);
    const w = Number(wallet);
    if (cash === "" || wallet === "" || Number.isNaN(c) || Number.isNaN(w)) return toast.error("Completá efectivo y billetera virtual");
    setSaving(true);
    try {
      await apiClient.saveCashSnapshot(lineId, { cash: c, wallet: w, asOf });
      toast.success("Caja actualizada");
      onChanged();
    } catch {
      toast.error("Error al guardar la caja");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) return <Spinner />;

  return (
    <div>
      <div className="me-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Total en caja" value={data.snapshot?.total ?? 0} sub={data.snapshot ? `al ${formatDay(data.snapshot.asOf)}` : "sin cargar"} />
        <Kpi label="Deuda con socios" value={data.partnerDebtTotal} color="var(--ha-red)" />
        <Kpi label="Efectivo realmente disponible" value={data.availableCash} color={data.availableCash < 0 ? "var(--ha-red)" : "var(--ha-green)"} />
        <Kpi label="Pendiente por cobrar" value={data.pendingReceivable} />
        <Kpi label="Pendiente por pagar" value={data.pendingPayable} />
      </div>

      <div className="pc-card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: 15 }}>Actualizar caja</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
          <div className="ha-field">
            <label className="ha-label">Efectivo</label>
            <input type="number" className="ha-input" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div className="ha-field">
            <label className="ha-label">Billetera virtual / Mercado Pago</label>
            <input type="number" className="ha-input" value={wallet} onChange={(e) => setWallet(e.target.value)} />
          </div>
          <div className="ha-field">
            <label className="ha-label">Al día</label>
            <input type="date" className="ha-input" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
        </div>
        <button className="ha-btn ha-btn--primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar caja"}
        </button>
      </div>

      <div className="pc-card">
        <h2 style={{ margin: "12px 16px 0", fontSize: 15 }}>Saldos con quien puso o cobró plata por Alumo</h2>
        <div className="pc-tablewrap">
          <table className="pc-table">
            <thead>
              <tr><th>Persona</th><th>Gastos que pagó (reembolso pendiente)</th><th>Ingresos que cobró (a rendir)</th><th>Alumo le debe</th></tr>
            </thead>
            <tbody>
              {data.partnerDebts.map((p) => (
                <tr key={p.partner}>
                  <td>{p.partner}</td>
                  <td>{formatCurrency(p.paidExpenses)}</td>
                  <td>{formatCurrency(p.collectedIncome)}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(p.owed)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="ex-foot"><td colSpan={3}>Total</td><td>{formatCurrency(data.partnerDebtTotal)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
