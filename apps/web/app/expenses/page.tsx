"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useLineContext } from "@/lib/line-context";
import { toast } from "@/lib/toast";
import type { CreateExpenseRequest, Expense } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ExpenseGroup = {
  groupId: string;
  description: string;
  createdAt: string;
  cashAmount: number;
  cardAmount: number;
};

export default function ExpensesPage() {
  return (
    <AppLayout>
      <ExpensesContent />
    </AppLayout>
  );
}

function ExpensesContent() {
  const { selectedLineId } = useLineContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState("");
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
    load();
  }, [fetchAllExpenses]);

  useEffect(() => {
    if (drawerOpen) setTimeout(() => descRef.current?.focus(), 80);
  }, [drawerOpen]);

  const openCreate = () => {
    setFdesc(""); setFcash(""); setFcard("");
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedLineId) { toast.error("Seleccioná una línea de negocio"); return; }
    const cashAmount = Number(fcash) || 0;
    const cardAmount = Number(fcard) || 0;
    if (cashAmount <= 0 && cardAmount <= 0) {
      toast.error("Debe ingresar un monto mayor a 0");
      return;
    }
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
      setDrawerOpen(false);
      await fetchAllExpenses();
    } catch {
      toast.error("Error al registrar egreso");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Egresos</h1>
        <button className="ha-btn ha-btn--primary" onClick={openCreate} disabled={!selectedLineId}>
          <Plus size={15} /> Nuevo egreso
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">Sin egresos</p>
          <p className="ha-empty__s">Registrá el primer egreso con el botón de arriba.</p>
        </div>
      ) : (
        <>
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Fecha</th>
                  <th>Efectivo</th>
                  <th>Transferencia</th>
                  <th>Total</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.groupId}>
                    <td style={{ fontWeight: 500 }}>{g.description || "—"}</td>
                    <td className="ha-mono" style={{ color: "var(--ha-text-2)" }}>
                      {new Date(g.createdAt).toLocaleDateString("es-AR")}
                    </td>
                    <td className="ha-mono">{formatCurrency(g.cashAmount)}</td>
                    <td className="ha-mono">{formatCurrency(g.cardAmount)}</td>
                    <td className="ha-mono" style={{ fontWeight: 600 }}>
                      {formatCurrency(g.cashAmount + g.cardAmount)}
                    </td>
                    <td>
                      <button
                        onClick={() => { setDeleteId(g.groupId); setDeleteTarget(g.description); }}
                        style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 7, color: "var(--ha-red)", cursor: "pointer" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ha-cardlist">
            {groups.map((g) => (
              <div key={g.groupId} className="ha-ordcard">
                <div className="ha-ordcard__top">
                  <span className="ha-ordcard__name">{g.description || "Egreso"}</span>
                  <button
                    onClick={() => { setDeleteId(g.groupId); setDeleteTarget(g.description); }}
                    style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 8, color: "var(--ha-red)", cursor: "pointer" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="ha-ordcard__grid">
                  <div><div className="ha-kv__l">Fecha</div><div className="ha-kv__v ha-mono">{new Date(g.createdAt).toLocaleDateString("es-AR")}</div></div>
                  <div><div className="ha-kv__l">Total</div><div className="ha-kv__v ha-mono" style={{ color: "var(--ha-amber)" }}>{formatCurrency(g.cashAmount + g.cardAmount)}</div></div>
                  <div><div className="ha-kv__l">Efectivo</div><div className="ha-kv__v ha-mono">{formatCurrency(g.cashAmount)}</div></div>
                  <div><div className="ha-kv__l">Transferencia</div><div className="ha-kv__v ha-mono">{formatCurrency(g.cardAmount)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="ha-fab" onClick={openCreate} aria-label="Nuevo egreso">
        <Plus size={24} />
      </button>

      {drawerOpen && (
        <>
          <div className="ha-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="ha-drawer">
            <div className="ha-sheet__handle" />
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">Nuevo egreso</span>
              <button className="ha-iconbtn" onClick={() => setDrawerOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="ha-drawer__body">
              <div className="ha-formgrid">
                <div className="ha-field">
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
                    <label className="ha-label">Efectivo</label>
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
                    <label className="ha-label">Transferencia</label>
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
            </div>
            <div className="ha-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDrawerOpen(false)}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </div>
        </>
      )}

      {deleteId && (
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar egreso?</h3>
              <p className="ha-dialog__sub">Se borrarán también sus splits en efectivo y transferencia.</p>
            </div>
            <div className="ha-dialog__body">
              <p style={{ color: "var(--ha-text-2)", margin: 0, fontSize: 14 }}>
                Se eliminará <strong style={{ color: "var(--ha-text)" }}>{deleteTarget || "este egreso"}</strong>.
              </p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={async () => {
                try {
                  await apiClient.deleteExpenseGroup(deleteId!);
                  toast.success("Egreso eliminado");
                  setDeleteId(null);
                  await fetchAllExpenses();
                } catch {
                  toast.error("Error al eliminar egreso");
                  setDeleteId(null);
                }
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
