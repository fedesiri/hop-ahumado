"use client";

import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type {
  CreateCustomerInteractionRequest,
  CustomerInteraction,
  CustomerProfile,
  UpdateCustomerInteractionRequest,
} from "@/lib/types";
import { InteractionChannel } from "@/lib/types";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function CustomerInteractionsPage() {
  return <CustomerInteractionsContent />;
}

const CHANNEL_LABELS: Record<string, string> = {
  [InteractionChannel.CALL]: "Llamada",
  [InteractionChannel.EMAIL]: "Email",
  [InteractionChannel.WHATSAPP]: "WhatsApp",
  [InteractionChannel.MEETING]: "Reunión",
  [InteractionChannel.OTHER]: "Otro",
};

interface FormState {
  profileId: string;
  channel: string;
  date: string;
  notes: string;
  nextStep: string;
}

const EMPTY_FORM: FormState = { profileId: "", channel: "", date: "", notes: "", nextStep: "" };

function CustomerInteractionsContent() {
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  useEffect(() => {
    void fetchInteractions();
    void fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit]);

  async function fetchInteractions() {
    try {
      setLoading(true);
      const response = await apiClient.getCustomerInteractions(pagination.page, pagination.limit);
      setInteractions(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar interacciones");
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfiles() {
    try {
      const response = await apiClient.getCustomerProfiles(1, 100);
      setProfiles(response.data);
    } catch {}
  }

  function handleCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function handleEdit(record: CustomerInteraction) {
    setEditingId(record.id);
    setForm({
      profileId: record.profileId ?? "",
      channel: record.channel ?? "",
      date: record.date ? record.date.substring(0, 16) : "",
      notes: record.notes ?? "",
      nextStep: record.nextStep ?? "",
    });
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    try {
      await apiClient.deleteCustomerInteraction(confirmDeleteId);
      toast.success("Interacción eliminada");
      setConfirmDeleteId(null);
      void fetchInteractions();
    } catch {
      toast.error("Error al eliminar interacción");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.profileId) { toast.error("El perfil es requerido"); return; }
    setSubmitting(true);
    try {
      const data: CreateCustomerInteractionRequest = {
        profileId: form.profileId,
        channel: (form.channel as InteractionChannel) || undefined,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        notes: form.notes || undefined,
        nextStep: form.nextStep || undefined,
      };
      if (editingId) {
        await apiClient.updateCustomerInteraction(editingId, data as UpdateCustomerInteractionRequest);
        toast.success("Interacción actualizada");
      } else {
        await apiClient.createCustomerInteraction(data);
        toast.success("Interacción creada");
      }
      setModalOpen(false);
      void fetchInteractions();
    } catch {
      toast.error("Error al guardar interacción");
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;

  return (
    <div>
      <div className="ci-pagehd">
        <div>
          <h1 className="ci-pagetitle">Interacciones con Clientes</h1>
        </div>
        <button className="ha-btn ha-btn--primary" onClick={handleCreate}>
          <Plus size={16} /> Nueva Interacción
        </button>
      </div>

      {loading ? (
        <div className="ha-spin-wrap"><div className="ha-spin-el" /></div>
      ) : (
        <div className="ci-card">
          <div className="ci-tablewrap">
            <table className="ci-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Medio</th>
                  <th>Fecha</th>
                  <th>Notas</th>
                  <th>Próximo paso</th>
                  <th className="r">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {interactions.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px 16px", color: "var(--ha-text-3)" }}>No hay interacciones</td></tr>
                ) : (
                  interactions.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="ci-cl__n">{row.profile?.customer?.name ?? "-"}</div>
                      </td>
                      <td>
                        {row.channel ? (
                          <span className="ci-badge ci-badge--blue">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>
                        ) : "-"}
                      </td>
                      <td><span className="ci-date">{row.date ? new Date(row.date).toLocaleDateString("es-AR") : "-"}</span></td>
                      <td>
                        <span className="ci-notes">{row.notes ? (row.notes.length > 50 ? row.notes.substring(0, 50) + "…" : row.notes) : "-"}</span>
                      </td>
                      <td><span className="ci-next">{row.nextStep ?? "-"}</span></td>
                      <td className="r">
                        <div className="ci-acts">
                          <button className="ci-minibtn" onClick={() => handleEdit(row)}><Edit2 size={13} /></button>
                          <button className="ci-minibtn ci-minibtn--del" onClick={() => setConfirmDeleteId(row.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="ci-cardlist">
            {interactions.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--ha-text-3)" }}>No hay interacciones</div>
            ) : (
              interactions.map((row) => (
                <div key={row.id} className="ci-crow">
                  <div className="ci-crow__top">
                    <span className="ci-crow__name">{row.date ? new Date(row.date).toLocaleDateString("es-AR") : "-"}</span>
                    {row.channel && <span className="ci-badge ci-badge--blue">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>}
                  </div>
                  <div className="ci-crow__cust">
                    <span style={{ fontSize: 13, color: "var(--ha-text-2)" }}>{row.profile?.customer?.name ?? "-"}</span>
                  </div>
                  {row.notes && <p className="ci-crow__notes">{row.notes}</p>}
                  {row.nextStep && <p className="ci-crow__next">{row.nextStep}</p>}
                  <div className="ci-crow__acts">
                    <button className="ci-minibtn" onClick={() => handleEdit(row)}><Edit2 size={13} /></button>
                    <button className="ci-minibtn ci-minibtn--del" onClick={() => setConfirmDeleteId(row.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {meta && meta.total > pagination.limit && (
            <div className="ci-pag" style={{ padding: "16px" }}>
              <span className="ci-pag__info">{meta.total} resultados</span>
              <div className="ci-pag__btns">
                <button className="ci-pgbtn" disabled={pagination.page === 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>←</button>
                <span className="ci-pgbtn act">{pagination.page}</span>
                <button className="ci-pgbtn" disabled={pagination.page >= totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>→</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form modal */}
      {modalOpen && (
        <div className="ha-dialog-back" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="ha-dialog ha-dialog--wide">
            <div className="ha-dialog__head">
              <h2 className="ha-dialog__title">{editingId ? "Editar Interacción" : "Nueva Interacción"}</h2>
              <button className="ha-iconbtn" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ha-dialog__body" style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflowY: "auto" }}>
                <div className="ci-field">
                  <label className="ci-label">Perfil de Cliente <span className="req">*</span></label>
                  <select className="ci-fselect" value={form.profileId} onChange={(e) => setForm((f) => ({ ...f, profileId: e.target.value }))} required>
                    <option value="">Selecciona un perfil</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.customer?.name ?? "N/A"}</option>)}
                  </select>
                </div>
                <div className="ci-grid2">
                  <div className="ci-field">
                    <label className="ci-label">Medio de contacto</label>
                    <select className="ci-fselect" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
                      <option value="">Seleccionar</option>
                      {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="ci-field">
                    <label className="ci-label">Fecha</label>
                    <input className="ci-input" type="datetime-local" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div className="ci-field">
                  <label className="ci-label">Resumen / Notas</label>
                  <textarea className="ci-textarea" placeholder="Notas de la interacción" rows={4} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="ci-field">
                  <label className="ci-label">Próximo paso</label>
                  <input className="ci-input" placeholder="Próximo paso" value={form.nextStep} onChange={(e) => setForm((f) => ({ ...f, nextStep: e.target.value }))} />
                </div>
              </div>
              <div className="ha-dialog__foot">
                <button type="button" className="ha-btn ha-btn--secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="ha-btn ha-btn--primary" disabled={submitting}>
                  {submitting ? "Guardando..." : editingId ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="ha-dialog-back" onClick={(e) => e.target === e.currentTarget && setConfirmDeleteId(null)}>
          <div className="ha-dialog">
            <div className="ha-dialog__head">
              <h2 className="ha-dialog__title">Confirmar eliminación</h2>
            </div>
            <div className="ha-dialog__body">
              <p style={{ margin: 0 }}>¿Estás seguro de que deseas eliminar esta interacción?</p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
