"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type {
  CreateCustomerProfileRequest,
  Customer,
  CustomerProfile,
  UpdateCustomerProfileRequest,
  User,
} from "@/lib/types";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function CustomerProfilesPage() {
  return (
    <AppLayout>
      <CustomerProfilesContent />
    </AppLayout>
  );
}

interface FormState {
  customerId: string;
  contactName: string;
  phone: string;
  email: string;
  customerType: string;
  status: string;
  source: string;
  responsibleId: string;
  generalNotes: string;
  nextFollowUpAt: string;
}

const EMPTY_FORM: FormState = {
  customerId: "",
  contactName: "",
  phone: "",
  email: "",
  customerType: "",
  status: "",
  source: "",
  responsibleId: "",
  generalNotes: "",
  nextFollowUpAt: "",
};

function CustomerProfilesContent() {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  useEffect(() => {
    void fetchProfiles();
    void fetchCustomers();
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit]);

  async function fetchProfiles() {
    try {
      setLoading(true);
      const response = await apiClient.getCustomerProfiles(pagination.page, pagination.limit);
      setProfiles(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar perfiles");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers() {
    try {
      const response = await apiClient.getCustomers(1, 100);
      setCustomers(response.data);
    } catch {}
  }

  async function fetchUsers() {
    try {
      const response = await apiClient.getUsers(1, 100);
      setUsers(response.data);
    } catch {
      toast.error("Error al cargar usuarios");
    }
  }

  function handleCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function handleEdit(record: CustomerProfile) {
    setEditingId(record.id);
    setForm({
      customerId: record.customerId ?? "",
      contactName: record.contactName ?? "",
      phone: record.phone ?? "",
      email: record.email ?? "",
      customerType: record.customerType ?? "",
      status: record.status ?? "",
      source: record.source ?? "",
      responsibleId: record.responsibleId ?? "",
      generalNotes: record.generalNotes ?? "",
      nextFollowUpAt: record.nextFollowUpAt ? record.nextFollowUpAt.substring(0, 10) : "",
    });
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    try {
      await apiClient.deleteCustomerProfile(confirmDeleteId);
      toast.success("Perfil eliminado");
      setConfirmDeleteId(null);
      void fetchProfiles();
    } catch {
      toast.error("Error al eliminar perfil");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) { toast.error("El cliente es requerido"); return; }
    setSubmitting(true);
    try {
      const data: CreateCustomerProfileRequest = {
        customerId: form.customerId,
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        customerType: form.customerType || undefined,
        status: form.status || undefined,
        source: form.source || undefined,
        responsibleId: form.responsibleId || undefined,
        generalNotes: form.generalNotes || undefined,
        nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : undefined,
      };
      if (editingId) {
        await apiClient.updateCustomerProfile(editingId, data as UpdateCustomerProfileRequest);
        toast.success("Perfil actualizado");
      } else {
        await apiClient.createCustomerProfile(data);
        toast.success("Perfil creado");
      }
      setModalOpen(false);
      void fetchProfiles();
    } catch {
      toast.error("Error al guardar perfil");
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;

  return (
    <div>
      <div className="cf-pagehd">
        <div>
          <h1 className="cf-pagetitle">Perfiles de Clientes</h1>
        </div>
        <button className="ha-btn ha-btn--primary" onClick={handleCreate}>
          <Plus size={16} /> Nuevo Perfil
        </button>
      </div>

      {loading ? (
        <div className="ha-spin-wrap"><div className="ha-spin-el" /></div>
      ) : (
        <div className="cf-card">
          <div className="cf-tablewrap">
            <table className="cf-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th className="r">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr><td colSpan={6} className="cf-empty">No hay perfiles</td></tr>
                ) : (
                  profiles.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="cf-cl">
                          <div className="cf-cl__av">{(p.customer?.name ?? "?")[0]?.toUpperCase()}</div>
                          <span className="cf-cl__n">{p.customer?.name ?? "-"}</span>
                        </div>
                      </td>
                      <td>{p.contactName ?? "-"}</td>
                      <td>{p.customerType ? <span className="cf-badge cf-badge--amber">{p.customerType}</span> : "-"}</td>
                      <td>{p.status ? <span className="cf-badge cf-badge--green">{p.status}</span> : "-"}</td>
                      <td><span className="cf-resp">{p.responsible?.name ?? <span className="none">—</span>}</span></td>
                      <td className="r">
                        <div className="cf-acts">
                          <button className="cf-minibtn" onClick={() => handleEdit(p)} title="Editar"><Edit2 size={13} /></button>
                          <button className="cf-minibtn cf-minibtn--del" onClick={() => setConfirmDeleteId(p.id)} title="Eliminar"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="cf-cardlist">
            {profiles.length === 0 ? (
              <div className="cf-empty">No hay perfiles</div>
            ) : (
              profiles.map((p) => (
                <div key={p.id} className="cf-crow">
                  <div className="cf-crow__top">
                    <div className="cf-cl__av">{(p.customer?.name ?? "?")[0]?.toUpperCase()}</div>
                    <span className="cf-crow__name">{p.customer?.name ?? "-"}</span>
                    {p.status && <span className="cf-badge cf-badge--green">{p.status}</span>}
                  </div>
                  <div className="cf-crow__mid">
                    {p.contactName && <span className="cf-resp">{p.contactName}</span>}
                    {p.customerType && <span className="cf-badge cf-badge--amber">{p.customerType}</span>}
                  </div>
                  <div className="cf-crow__bot">
                    <span className="cf-resp">{p.responsible?.name ?? "Sin responsable"}</span>
                  </div>
                  <div className="cf-crow__acts">
                    <button className="cf-minibtn" onClick={() => handleEdit(p)}><Edit2 size={13} /></button>
                    <button className="cf-minibtn cf-minibtn--del" onClick={() => setConfirmDeleteId(p.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {meta && meta.total > pagination.limit && (
            <div className="cf-pag" style={{ padding: "16px" }}>
              <span className="cf-pag__info">{meta.total} resultados</span>
              <div className="cf-pag__btns">
                <button className="cf-pgbtn" disabled={pagination.page === 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>←</button>
                <span className="cf-pgbtn act">{pagination.page}</span>
                <button className="cf-pgbtn" disabled={pagination.page >= totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>→</button>
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
              <h2 className="ha-dialog__title">{editingId ? "Editar Perfil" : "Nuevo Perfil"}</h2>
              <button className="ha-iconbtn" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ha-dialog__body" style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflowY: "auto" }}>
                <div className="cf-field">
                  <label className="cf-label">Cliente <span className="req">*</span></label>
                  <select className="cf-fselect" value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))} required>
                    <option value="">Selecciona un cliente</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="cf-grid2">
                  <div className="cf-field">
                    <label className="cf-label">Nombre del contacto</label>
                    <input className="cf-input" placeholder="Persona de contacto" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
                  </div>
                  <div className="cf-field">
                    <label className="cf-label">Teléfono</label>
                    <input className="cf-input" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="cf-grid2">
                  <div className="cf-field">
                    <label className="cf-label">Email</label>
                    <input className="cf-input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="cf-field">
                    <label className="cf-label">Tipo de cliente</label>
                    <input className="cf-input" placeholder="Tipo de cliente" value={form.customerType} onChange={(e) => setForm((f) => ({ ...f, customerType: e.target.value }))} />
                  </div>
                </div>
                <div className="cf-grid2">
                  <div className="cf-field">
                    <label className="cf-label">Estado</label>
                    <input className="cf-input" placeholder="Estado" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} />
                  </div>
                  <div className="cf-field">
                    <label className="cf-label">Fuente</label>
                    <input className="cf-input" placeholder="Fuente del cliente" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
                  </div>
                </div>
                <div className="cf-grid2">
                  <div className="cf-field">
                    <label className="cf-label">Responsable</label>
                    <select className="cf-fselect" value={form.responsibleId} onChange={(e) => setForm((f) => ({ ...f, responsibleId: e.target.value }))}>
                      <option value="">Sin responsable</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="cf-field">
                    <label className="cf-label">Próximo seguimiento</label>
                    <input className="cf-input" type="date" value={form.nextFollowUpAt} onChange={(e) => setForm((f) => ({ ...f, nextFollowUpAt: e.target.value }))} />
                  </div>
                </div>
                <div className="cf-field">
                  <label className="cf-label">Notas generales</label>
                  <textarea className="cf-textarea" placeholder="Notas" rows={2} value={form.generalNotes} onChange={(e) => setForm((f) => ({ ...f, generalNotes: e.target.value }))} />
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

      {/* Confirm delete */}
      {confirmDeleteId && (
        <div className="ha-dialog-back" onClick={(e) => e.target === e.currentTarget && setConfirmDeleteId(null)}>
          <div className="ha-dialog">
            <div className="ha-dialog__head">
              <h2 className="ha-dialog__title">Confirmar eliminación</h2>
            </div>
            <div className="ha-dialog__body">
              <p style={{ margin: 0 }}>¿Estás seguro de que deseas eliminar este perfil?</p>
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
