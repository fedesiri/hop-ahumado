"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { CreateExpenseRequest, Expense } from "@/lib/types";
import { Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ExpenseGroup = {
  groupId: string;
  description: string;
  createdAt: string;
  cashAmount: number;
  cardAmount: number;
};

export default function ExpensesPage() {
  return <ExpensesContent />;
}

function ExpensesContent() {
  const { selectedLineId } = useLineContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState("");

  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [fdesc, setFdesc] = useState("");
  const [fcash, setFcash] = useState("");
  const [fcard, setFcard] = useState("");
  const descRef = useRef<HTMLInputElement>(null);

  const groups: ExpenseGroup[] = useMemo(() => {
    const byGroup = new Map<string, { description: string; createdAt: string; cashAmount: number; cardAmount: number }>();
    for (const e of expenses) {
      const group = byGroup.get(e.groupId) ?? {
        description: e.description ?? "Egreso",
        createdAt: e.createdAt,
        cashAmount: 0,
        cardAmount: 0,
      };
      if (e.method === "CASH") group.cashAmount += Number(e.amount ?? 0);
      if (e.method === "CARD") group.cardAmount += Number(e.amount ?? 0);
      byGroup.set(e.groupId, group);
    }
    return [...byGroup.entries()].map(([groupId, v]) => ({ groupId, ...v }));
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    return groups.filter((g) => {
      if (q && !g.description.toLowerCase().includes(q)) return false;
      const d = new Date(g.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [groups, searchText, dateFrom, dateTo]);

  const totalCash = filtered.reduce((s, g) => s + g.cashAmount, 0);
  const totalCard = filtered.reduce((s, g) => s + g.cardAmount, 0);
  const totalAll = totalCash + totalCard;

  // TODO: this fetches all records to support client-side filtering and KPI totals.
  // Fix requires: (1) add search/dateFrom/dateTo params to GET /expenses backend endpoint,
  // (2) add totals to the response meta, (3) switch to server-side pagination here.
  const fetchAllExpenses = useCallback(async () => {
    const bId = selectedLineId ?? undefined;
    const limit = 100;
    let page = 1;
    let res = await apiClient.getExpenses(page, limit, bId);
    const all: Expense[] = [...res.data];
    while (res.meta.totalPages > page) {
      page += 1;
      res = await apiClient.getExpenses(page, limit, bId);
      all.push(...res.data);
    }
    setExpenses(all);
  }, [selectedLineId]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchAllExpenses();
      } catch {
        toast.error("Error al cargar egresos");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [fetchAllExpenses]);

  useEffect(() => {
    if (modalOpen) setTimeout(() => descRef.current?.focus(), 80);
  }, [modalOpen]);

  const openCreate = () => {
    setFdesc(""); setFcash(""); setFcard("");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedLineId) { toast.error("Seleccioná una línea de negocio"); return; }
    const cashAmount = Number(fcash) || 0;
    const cardAmount = Number(fcard) || 0;
    if (cashAmount <= 0 && cardAmount <= 0) { toast.error("Debe ingresar un monto mayor a 0"); return; }
    const data: CreateExpenseRequest = {
      businessLineId: selectedLineId,
      description: fdesc || undefined,
      cashAmount,
      cardAmount,
    };
    setSubmitting(true);
    try {
      await apiClient.createExpense(data);
      toast.success("Egreso registrado");
      setModalOpen(false);
      await fetchAllExpenses();
    } catch {
      toast.error("Error al registrar egreso");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiClient.deleteExpenseGroup(deleteId);
      toast.success("Egreso eliminado");
      setDeleteId(null);
      await fetchAllExpenses();
    } catch {
      toast.error("Error al eliminar egreso");
      setDeleteId(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>Egresos</h1>
        <button className="pc-btn pc-btn--primary" onClick={openCreate} disabled={!selectedLineId}>
          + Nuevo egreso
        </button>
      </div>

      {/* KPI summary cards */}
      <div className="me-kpis" style={{ marginBottom: 16 }}>
        <div className="me-kpi">
          <div className="me-kpi__label">💵 Efectivo total</div>
          <div className="me-kpi__val" style={{ color: "var(--ha-green)" }}>{formatCurrency(totalCash)}</div>
        </div>
        <div className="me-kpi">
          <div className="me-kpi__label">💳 Tarjeta total</div>
          <div className="me-kpi__val" style={{ color: "var(--ha-blue)" }}>{formatCurrency(totalCard)}</div>
        </div>
        <div className="me-kpi">
          <div className="me-kpi__label">📊 Total período</div>
          <div className="me-kpi__val">{formatCurrency(totalAll)}</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="pc-filter">
        <div className="pc-search">
          <Search size={17} />
          <input
            placeholder="Buscar descripción…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <input
          type="date"
          className="ex-date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="Fecha desde"
          title="Fecha desde"
        />
        <input
          type="date"
          className="ex-date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="Fecha hasta"
          title="Fecha hasta"
        />
        <span className="pc-count">{filtered.length} egresos</span>
      </div>

      {/* Main content */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)",
            animation: "ha-spin .7s linear infinite",
          }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">{groups.length === 0 ? "Sin egresos registrados" : "Sin resultados para los filtros aplicados"}</p>
        </div>
      ) : (
        <div className="pc-card">
          {/* Desktop table */}
          <div className="pc-tablewrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Fecha</th>
                  <th>💵 Efectivo</th>
                  <th>💳 Tarjeta</th>
                  <th>Total</th>
                  <th style={{ width: 56 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.groupId}>
                    <td style={{ fontWeight: 500 }}>{g.description || "—"}</td>
                    <td className="pc-vig">{new Date(g.createdAt).toLocaleDateString("es-AR")}</td>
                    <td>
                      {g.cashAmount > 0
                        ? <span className="ex-cash">{formatCurrency(g.cashAmount)}</span>
                        : <span className="ex-muted">—</span>}
                    </td>
                    <td>
                      {g.cardAmount > 0
                        ? <span className="ex-card">{formatCurrency(g.cardAmount)}</span>
                        : <span className="ex-muted">—</span>}
                    </td>
                    <td><span className="ex-total">{formatCurrency(g.cashAmount + g.cardAmount)}</span></td>
                    <td>
                      <button
                        className="pc-btn pc-btn--ghost pc-btn--sm"
                        style={{ color: "var(--ha-red)", borderColor: "var(--ha-red)", padding: "0 10px" }}
                        onClick={() => { setDeleteId(g.groupId); setDeleteTarget(g.description); }}
                        aria-label="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="ex-foot">
                  <td colSpan={2}>Total</td>
                  <td><span className="ex-cash">{formatCurrency(totalCash)}</span></td>
                  <td><span className="ex-card">{formatCurrency(totalCard)}</span></td>
                  <td><span className="ex-total">{formatCurrency(totalAll)}</span></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="pc-cardlist">
            {filtered.map((g) => (
              <div key={g.groupId} className="pc-pcard">
                <div className="pc-pcard__top">
                  <div className="pc-pcard__name">{g.description || "Egreso"}</div>
                  <button
                    className="pc-btn pc-btn--ghost pc-btn--sm"
                    style={{ color: "var(--ha-red)", borderColor: "var(--ha-red)", padding: "0 8px", flexShrink: 0 }}
                    onClick={() => { setDeleteId(g.groupId); setDeleteTarget(g.description); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="pc-pcard__mid">
                  <span className="ex-total pc-pcard__price">{formatCurrency(g.cashAmount + g.cardAmount)}</span>
                </div>
                <div className="pc-pcard__bot">
                  <span className="pc-vig">{new Date(g.createdAt).toLocaleDateString("es-AR")}</span>
                  <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                    {g.cashAmount > 0 && <span className="ex-cash">{formatCurrency(g.cashAmount)}</span>}
                    {g.cardAmount > 0 && <span className="ex-card">{formatCurrency(g.cardAmount)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <div className="ha-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ha-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Nuevo egreso</span>
              <button className="ha-iconbtn" onClick={() => setModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <div className="ha-field" style={{ marginBottom: 16 }}>
                <label className="ha-label">Descripción</label>
                <input
                  ref={descRef}
                  className="ha-input"
                  placeholder="Ej. Productos - pallet / Transporte"
                  value={fdesc}
                  onChange={(e) => setFdesc(e.target.value)}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ha-field">
                  <label className="ha-label">💵 Efectivo</label>
                  <input
                    type="number"
                    className="ha-input"
                    placeholder="0"
                    min={0}
                    step={0.01}
                    value={fcash}
                    onChange={(e) => setFcash(e.target.value)}
                  />
                </div>
                <div className="ha-field">
                  <label className="ha-label">💳 Tarjeta</label>
                  <input
                    type="number"
                    className="ha-input"
                    placeholder="0"
                    min={0}
                    step={0.01}
                    value={fcard}
                    onChange={(e) => setFcard(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar egreso?</h3>
              <p className="ha-dialog__sub">
                Se eliminará <strong>{deleteTarget || "este egreso"}</strong> junto con sus registros de efectivo y tarjeta.
              </p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={() => void handleDelete()}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
