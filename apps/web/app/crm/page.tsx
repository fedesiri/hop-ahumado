"use client";

import { apiClient } from "@/lib/api-client";
import {
  CRM_CUSTOMER_TYPE_OPTIONS,
  CRM_SOURCE_OPTIONS,
  CRM_STATUS_OPTIONS,
  mergeCrmSelectOptions,
  normalizeCrmStatusForForm,
} from "@/lib/crm-profile-options";
import dayjs from "@/lib/dayjs";
import { toast } from "@/lib/toast";
import type { CreateCrmCustomerRequest, CrmCustomerListItem, PaginationMeta, User } from "@/lib/types";
import { formatStatusLabel } from "@/lib/utils";
import { Eye, FilePen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STATUS_COLOR: Record<string, string> = {
  lead: "#60a5fa",
  prospecto: "#818cf8",
  cliente: "#4ade80",
  pausado: "#fbbf24",
  perdido: "#f87171",
};

function statusBadge(status: string | null) {
  const label = formatStatusLabel(status);
  if (!label) return "—";
  const color = STATUS_COLOR[label.toLowerCase()] ?? "var(--ha-text-3)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {label}
    </span>
  );
}

export default function CrmPage() {
  return <CrmContent />;
}

function CrmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [list, setList] = useState<CrmCustomerListItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [creatingProfileForId, setCreatingProfileForId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<CrmCustomerListItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState<string>(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
  const [sourceFilter, setSourceFilter] = useState(() => searchParams.get("source") ?? "");
  const [customerTypeFilter, setCustomerTypeFilter] = useState(() => searchParams.get("customerType") ?? "");
  const [responsibleIdFilter, setResponsibleIdFilter] = useState(() => searchParams.get("responsibleId") ?? "");

  // Form state
  const [fCustomerType, setFCustomerType] = useState("Empresa");
  const [fName, setFName] = useState("");
  const [fContactName, setFContactName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fSource, setFSource] = useState("");
  const [fResponsibleId, setFResponsibleId] = useState("");
  const [fGeneralNotes, setFGeneralNotes] = useState("");
  const [fNextFollowUpAt, setFNextFollowUpAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // pending modal form values ref (same pattern as original)
  const pendingModalFormRef = useRef<Record<string, unknown> | false | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const statusFormOptions = useMemo(
    () => mergeCrmSelectOptions(
      editingRecord ? (normalizeCrmStatusForForm(editingRecord.status) ?? editingRecord.status ?? undefined) : undefined,
      CRM_STATUS_OPTIONS,
    ),
    [editingRecord, modalOpen],
  );
  const customerTypeFormOptions = useMemo(
    () => mergeCrmSelectOptions(editingRecord?.customerType ?? undefined, CRM_CUSTOMER_TYPE_OPTIONS),
    [editingRecord, modalOpen],
  );
  const sourceFormOptions = useMemo(
    () => mergeCrmSelectOptions(editingRecord?.source ?? undefined, CRM_SOURCE_OPTIONS),
    [editingRecord, modalOpen],
  );

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.listCrmCustomers(
        pagination.page,
        pagination.limit,
        search || undefined,
        statusFilter || undefined,
        sourceFilter || undefined,
        customerTypeFilter || undefined,
        responsibleIdFilter || undefined,
      );
      setList(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar clientes CRM");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, sourceFilter, customerTypeFilter, responsibleIdFilter]);

  useEffect(() => { void fetchList(); void fetchUsers(); }, [fetchList]);

  const fetchUsers = async () => {
    try {
      const response = await apiClient.getUsers(1, 100);
      setUsers(response.data);
    } catch {
      // silent
    }
  };

  const applyPendingForm = () => {
    const pending = pendingModalFormRef.current;
    if (pending === false) {
      setFCustomerType("Empresa");
      setFName(""); setFContactName(""); setFPhone(""); setFEmail("");
      setFStatus(""); setFSource(""); setFResponsibleId(""); setFGeneralNotes(""); setFNextFollowUpAt("");
      pendingModalFormRef.current = null;
    } else if (pending && typeof pending === "object") {
      setFCustomerType(String(pending.customerType ?? ""));
      setFName(String(pending.name ?? ""));
      setFContactName(String(pending.contactName ?? ""));
      setFPhone(String(pending.phone ?? ""));
      setFEmail(String(pending.email ?? ""));
      setFStatus(String(pending.status ?? ""));
      setFSource(String(pending.source ?? ""));
      setFResponsibleId(String(pending.responsibleId ?? ""));
      setFGeneralNotes(String(pending.generalNotes ?? ""));
      const nfua = pending.nextFollowUpAt;
      setFNextFollowUpAt(nfua ? dayjs(nfua as string).format("YYYY-MM-DD") : "");
      pendingModalFormRef.current = null;
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    pendingModalFormRef.current = false;
    setModalOpen(true);
    setTimeout(applyPendingForm, 0);
  };

  const handleEdit = async (record: CrmCustomerListItem) => {
    setEditingRecord(record);
    if (record.profileId) {
      try {
        setLoadingDetail(true);
        const detail = await apiClient.getCrmCustomerDetail(record.profileId);
        pendingModalFormRef.current = {
          name: detail.customer.name,
          customerType: detail.customerType,
          contactName: detail.contactName,
          phone: detail.phone,
          email: detail.email,
          status: normalizeCrmStatusForForm(detail.status) ?? detail.status ?? "",
          source: detail.source,
          responsibleId: detail.responsibleId,
          generalNotes: detail.generalNotes,
          nextFollowUpAt: detail.nextFollowUpAt,
        };
      } catch {
        toast.error("Error al cargar el cliente");
        setEditingRecord(null);
        pendingModalFormRef.current = null;
        return;
      } finally {
        setLoadingDetail(false);
      }
    } else {
      pendingModalFormRef.current = {
        name: record.customerName,
        customerType: record.customerType,
        contactName: record.contactName,
        phone: record.phone,
        email: record.email,
        status: normalizeCrmStatusForForm(record.status) ?? record.status ?? "",
        source: record.source,
        responsibleId: record.responsibleId,
        generalNotes: null,
        nextFollowUpAt: null,
      };
    }
    setModalOpen(true);
    setTimeout(applyPendingForm, 0);
  };

  const goToCustomer = async (record: CrmCustomerListItem) => {
    if (record.profileId) { router.push(`/crm/customers/${record.profileId}`); return; }
    try {
      setCreatingProfileForId(record.customerId);
      const profile = await apiClient.createCustomerProfile({ customerId: record.customerId });
      toast.success("Perfil CRM creado");
      void fetchList();
      router.push(`/crm/customers/${profile.id}`);
    } catch {
      toast.error("Error al crear perfil");
    } finally {
      setCreatingProfileForId(null);
    }
  };

  const handleSubmit = async () => {
    if (!fName.trim()) { toast.error("El nombre es requerido"); return; }
    setSubmitting(true);
    try {
      const normalizedEmail = fEmail.trim();
      const profilePayload = {
        contactName: fContactName || undefined,
        phone: fPhone || undefined,
        email: normalizedEmail || undefined,
        customerType: fCustomerType || undefined,
        status: fStatus || undefined,
        source: fSource || undefined,
        responsibleId: fResponsibleId || undefined,
        generalNotes: fGeneralNotes || undefined,
        nextFollowUpAt: fNextFollowUpAt ? new Date(fNextFollowUpAt).toISOString() : undefined,
      };
      if (editingRecord) {
        await apiClient.updateCustomer(editingRecord.customerId, { name: fName.trim() });
        if (editingRecord.profileId) {
          await apiClient.updateCrmCustomerProfile(editingRecord.profileId, profilePayload);
        } else {
          await apiClient.createCustomerProfile({ customerId: editingRecord.customerId, ...profilePayload });
        }
        toast.success("Cliente actualizado");
        setEditingRecord(null);
      } else {
        await apiClient.createCrmCustomer({ name: fName.trim(), ...profilePayload } as CreateCrmCustomerRequest);
        toast.success("Cliente creado");
      }
      setModalOpen(false);
      void fetchList();
    } catch {
      toast.error(editingRecord ? "Error al actualizar cliente" : "Error al crear cliente");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = meta ? Math.ceil(meta.total / pagination.limit) : 1;

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">CRM — Clientes</h1>
        <button className="ha-btn ha-btn--primary" onClick={handleCreate}>
          + Nuevo cliente
        </button>
      </div>

      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input
          type="search"
          className="ha-input"
          placeholder="Buscar: nombre, contacto, email, teléfono…"
          style={{ minWidth: 220 }}
          value={search}
          onChange={(e) => {
            setPagination((p) => ({ ...p, page: 1 }));
            setSearch(e.target.value);
            updateParams({ search: e.target.value || null });
          }}
        />
        <select
          className="ha-input"
          style={{ minWidth: 200, width: "auto" }}
          value={customerTypeFilter}
          onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setCustomerTypeFilter(e.target.value); updateParams({ customerType: e.target.value || null }); }}
        >
          <option value="">Tipo de cliente</option>
          {CRM_CUSTOMER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="ha-input"
          style={{ minWidth: 200, width: "auto" }}
          value={statusFilter}
          onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setStatusFilter(e.target.value); updateParams({ status: e.target.value || null }); }}
        >
          <option value="">Estado del contacto</option>
          {CRM_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="ha-input"
          style={{ minWidth: 200, width: "auto" }}
          value={sourceFilter}
          onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setSourceFilter(e.target.value); updateParams({ source: e.target.value || null }); }}
        >
          <option value="">Origen</option>
          {CRM_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="ha-input"
          style={{ minWidth: 200, width: "auto" }}
          value={responsibleIdFilter}
          onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setResponsibleIdFilter(e.target.value); updateParams({ responsibleId: e.target.value || null }); }}
        >
          <option value="">Socio responsable</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : list.length === 0 ? (
        <div className="ha-empty"><p className="ha-empty__t">No hay clientes</p></div>
      ) : (
        <div className="ha-table-wrap">
          <table className="ha-table">
            <thead>
              <tr>
                <th>Nombre / Razón social</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Responsable</th>
                <th title="La fecha más reciente entre la última entrega y el último seguimiento CRM.">Último vínculo</th>
                <th title="Días desde el último vínculo (pedido o seguimiento).">Días sin vínculo</th>
                <th>Próximo seguimiento</th>
                <th style={{ width: 120 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((record) => (
                <tr key={record.customerId}>
                  <td>
                    <button
                      onClick={() => void goToCustomer(record)}
                      disabled={creatingProfileForId === record.customerId}
                      style={{ background: "none", border: "none", color: "#22c55e", fontWeight: 500, cursor: "pointer", padding: 0, fontSize: 14, textAlign: "left" }}
                    >
                      {creatingProfileForId === record.customerId ? "…" : record.customerName}
                    </button>
                  </td>
                  <td>{statusBadge(record.status)}</td>
                  <td style={{ color: "var(--ha-text-3)" }}>{record.source || "—"}</td>
                  <td style={{ color: "var(--ha-text-3)" }}>{record.responsibleName || "—"}</td>
                  <td style={{ color: "var(--ha-text-3)" }}>{record.lastContactAt ? new Date(record.lastContactAt).toLocaleDateString("es-AR") : "—"}</td>
                  <td style={{ color: record.daysSinceLastContact != null && record.daysSinceLastContact > 30 ? "#f59e0b" : "var(--ha-text-3)" }}>
                    {record.daysSinceLastContact != null ? record.daysSinceLastContact : "—"}
                  </td>
                  <td style={{ color: "var(--ha-text-3)" }}>{record.nextFollowUpAt ? new Date(record.nextFollowUpAt).toLocaleDateString("es-AR") : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="ha-btn ha-btn--primary ha-btn--sm"
                        title="Editar"
                        onClick={() => void handleEdit(record)}
                        disabled={loadingDetail && editingRecord?.customerId === record.customerId}
                        style={{ display: "inline-flex", alignItems: "center" }}
                      >
                        <FilePen size={12} />
                      </button>
                      <button
                        className="ha-btn ha-btn--secondary ha-btn--sm"
                        title={record.profileId ? "Ver cliente" : "Completar perfil"}
                        onClick={() => void goToCustomer(record)}
                        disabled={creatingProfileForId === record.customerId}
                        style={{ display: "inline-flex", alignItems: "center" }}
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <span style={{ color: "var(--ha-text-3)", fontSize: 13 }}>{meta.total} total · página {pagination.page} de {totalPages}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>‹</button>
            <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page >= totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>›</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="ha-modal-backdrop" onClick={() => { setModalOpen(false); setEditingRecord(null); }}>
          <div className="ha-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">{editingRecord ? "Editar cliente" : "Nuevo cliente"}</span>
              <button className="ha-iconbtn" onClick={() => { setModalOpen(false); setEditingRecord(null); }} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Tipo de cliente</label>
                <select className="ha-input" value={fCustomerType} onChange={(e) => setFCustomerType(e.target.value)}>
                  <option value="">Empresa o particular</option>
                  {customerTypeFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Nombre o razón social <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input className="ha-input" placeholder="Empresa: razón social. Particular: nombre y apellido" value={fName} onChange={(e) => setFName(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Persona de contacto (opcional)</label>
                <input className="ha-input" placeholder="En empresas: quién atiende" value={fContactName} onChange={(e) => setFContactName(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Teléfono</label>
                <input className="ha-input" placeholder="Teléfono de contacto" value={fPhone} onChange={(e) => setFPhone(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Email</label>
                <input type="email" className="ha-input" placeholder="Email de contacto" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Estado del contacto</label>
                <select className="ha-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  <option value="">Seleccioná un estado</option>
                  {statusFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">¿De dónde nos conoció? (origen del cliente)</label>
                <select className="ha-input" value={fSource} onChange={(e) => setFSource(e.target.value)}>
                  <option value="">Elegí un origen</option>
                  {sourceFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Socio responsable del seguimiento (opcional)</label>
                <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "var(--ha-text-3)" }}>Quién lleva o consiguió este cliente. Si ya es cliente fijo puede quedar sin asignar.</p>
                <select className="ha-input" value={fResponsibleId} onChange={(e) => setFResponsibleId(e.target.value)}>
                  <option value="">Ninguno</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginBottom: 14 }}>
                <label className="ha-label">Notas generales</label>
                <textarea className="ha-input" rows={2} placeholder="Anotaciones sobre el cliente" value={fGeneralNotes} onChange={(e) => setFGeneralNotes(e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div className="ha-field">
                <label className="ha-label">Fecha del próximo seguimiento</label>
                <input type="date" className="ha-input" placeholder="Cuándo volver a contactar" value={fNextFollowUpAt} onChange={(e) => setFNextFollowUpAt(e.target.value)} />
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => { setModalOpen(false); setEditingRecord(null); }}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>{submitting ? "Guardando…" : editingRecord ? "Guardar" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
