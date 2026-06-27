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
import { EmptyState } from "@/components/empty-state";
import { Paginator } from "@/components/paginator";
import { Spinner } from "@/components/spinner";
import { Eye, FilePen, ListFilter, Plus, Search, X } from "lucide-react";
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
  if (!label) return <span style={{ color: "var(--ha-text-3)" }}>—</span>;
  const color = STATUS_COLOR[label.toLowerCase()] ?? "var(--ha-text-3)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {label}
    </span>
  );
}

function tipoBadge(tipo: string | null) {
  if (!tipo) return <span style={{ color: "var(--ha-text-3)" }}>—</span>;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, background: "var(--ha-bg-raised)", color: "var(--ha-text-2)", border: "1px solid var(--ha-border-2)" }}>
      {formatStatusLabel(tipo)}
    </span>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
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

  // Mobile filter sheet draft state
  const [draftSearch, setDraftSearch] = useState(search);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftCustomerType, setDraftCustomerType] = useState(customerTypeFilter);
  const [draftSource, setDraftSource] = useState(sourceFilter);
  const [draftResponsibleId, setDraftResponsibleId] = useState(responsibleIdFilter);

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

  const activeFilterCount = [search, statusFilter, customerTypeFilter, sourceFilter, responsibleIdFilter].filter(Boolean).length;

  const openFilterSheet = () => {
    setDraftSearch(search);
    setDraftStatus(statusFilter);
    setDraftCustomerType(customerTypeFilter);
    setDraftSource(sourceFilter);
    setDraftResponsibleId(responsibleIdFilter);
    setFilterSheetOpen(true);
  };

  const applyFilters = () => {
    setPagination((p) => ({ ...p, page: 1 }));
    setSearch(draftSearch);
    setStatusFilter(draftStatus);
    setCustomerTypeFilter(draftCustomerType);
    setSourceFilter(draftSource);
    setResponsibleIdFilter(draftResponsibleId);
    updateParams({
      search: draftSearch || null,
      status: draftStatus || null,
      customerType: draftCustomerType || null,
      source: draftSource || null,
      responsibleId: draftResponsibleId || null,
    });
    setFilterSheetOpen(false);
  };

  const statusFormOptions = useMemo(
    () => mergeCrmSelectOptions(
      editingRecord ? (normalizeCrmStatusForForm(editingRecord.status) ?? editingRecord.status ?? undefined) : undefined,
      CRM_STATUS_OPTIONS,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingRecord, drawerOpen],
  );
  const customerTypeFormOptions = useMemo(
    () => mergeCrmSelectOptions(editingRecord?.customerType ?? undefined, CRM_CUSTOMER_TYPE_OPTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingRecord, drawerOpen],
  );
  const sourceFormOptions = useMemo(
    () => mergeCrmSelectOptions(editingRecord?.source ?? undefined, CRM_SOURCE_OPTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingRecord, drawerOpen],
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
    setDrawerOpen(true);
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
    setDrawerOpen(true);
    setTimeout(applyPendingForm, 0);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingRecord(null);
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
      setDrawerOpen(false);
      void fetchList();
    } catch {
      toast.error(editingRecord ? "Error al actualizar cliente" : "Error al crear cliente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">CRM — Clientes</h1>
        <button className="ha-btn ha-btn--primary ha-desktop-only" onClick={handleCreate}>
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      {/* Desktop filter bar */}
      <div className="ha-filters ha-desktop-only" style={{ marginBottom: 16 }}>
        <div className="ha-filters__row">
          <input
            type="search"
            className="ha-filter-input"
            style={{ flex: 2, minWidth: 140 }}
            placeholder="Buscar por nombre, contacto…"
            value={search}
            onChange={(e) => {
              setPagination((p) => ({ ...p, page: 1 }));
              setSearch(e.target.value);
              updateParams({ search: e.target.value || null });
            }}
          />
          <select
            className="ha-filter-input ha-select"
            style={{ flex: 1, minWidth: 110 }}
            value={customerTypeFilter}
            onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setCustomerTypeFilter(e.target.value); updateParams({ customerType: e.target.value || null }); }}
          >
            <option value="">Tipo</option>
            {CRM_CUSTOMER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className="ha-filter-input ha-select"
            style={{ flex: 1, minWidth: 110 }}
            value={statusFilter}
            onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setStatusFilter(e.target.value); updateParams({ status: e.target.value || null }); }}
          >
            <option value="">Estado</option>
            {CRM_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className="ha-filter-input ha-select"
            style={{ flex: 1, minWidth: 110 }}
            value={sourceFilter}
            onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setSourceFilter(e.target.value); updateParams({ source: e.target.value || null }); }}
          >
            <option value="">Origen</option>
            {CRM_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className="ha-filter-input ha-select"
            style={{ flex: 1, minWidth: 110 }}
            value={responsibleIdFilter}
            onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setResponsibleIdFilter(e.target.value); updateParams({ responsibleId: e.target.value || null }); }}
          >
            <option value="">Responsable</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Mobile filter button */}
      <div className="ha-mobile-only" style={{ marginBottom: 12 }}>
        <button
          onClick={openFilterSheet}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 40, padding: "0 16px", border: "1.5px solid var(--ha-border-2)",
            borderRadius: 10, background: "transparent", color: "var(--ha-text)",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            ...(activeFilterCount > 0 ? { borderColor: "var(--ha-amber)", color: "var(--ha-amber)" } : {}),
          }}
        >
          <ListFilter size={16} />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: "50%",
              background: "var(--ha-amber)", color: "#0f1117",
              fontSize: 11, fontWeight: 700,
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        {meta && (
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--ha-text-3)" }}>
            {meta.total} clientes
          </div>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="No hay clientes" subtitle="Creá el primer cliente con el botón de arriba." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Origen</th>
                  <th>Responsable</th>
                  <th title="Fecha del último pedido o seguimiento.">Último contacto</th>
                  <th title="Días desde el último contacto.">Días sin contacto</th>
                  <th>Próximo seguimiento</th>
                  <th style={{ width: 80 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((record) => {
                  const dias = record.daysSinceLastContact;
                  return (
                    <tr key={record.customerId}>
                      <td>
                        <button
                          onClick={() => void goToCustomer(record)}
                          disabled={creatingProfileForId === record.customerId}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ha-text)" }}>
                            {creatingProfileForId === record.customerId ? "…" : record.customerName}
                          </div>
                          {record.contactName && (
                            <div style={{ fontSize: 12, color: "var(--ha-text-3)", marginTop: 1 }}>
                              {record.contactName}
                            </div>
                          )}
                        </button>
                      </td>
                      <td>{tipoBadge(record.customerType)}</td>
                      <td>{statusBadge(record.status)}</td>
                      <td style={{ color: "var(--ha-text-3)", fontSize: 13 }}>{record.source || "—"}</td>
                      <td>
                        {record.responsibleName ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 28, height: 28, borderRadius: "50%",
                              background: "var(--ha-amber)", color: "#0f1117",
                              fontSize: 11, fontWeight: 700, flexShrink: 0,
                            }}>
                              {initials(record.responsibleName)}
                            </span>
                            <span style={{ fontSize: 13, color: "var(--ha-text-2)" }}>{record.responsibleName}</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--ha-text-3)" }}>—</span>
                        )}
                      </td>
                      <td style={{ color: "var(--ha-text-3)", fontSize: 13 }}>
                        {record.lastContactAt ? new Date(record.lastContactAt).toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td>
                        {dias != null ? (
                          <span style={{ color: dias > 30 ? "#f59e0b" : "var(--ha-text-3)", fontSize: 13 }}>
                            {dias} días
                          </span>
                        ) : (
                          <span style={{ color: "var(--ha-text-3)" }}>—</span>
                        )}
                      </td>
                      <td style={{ color: "var(--ha-text-3)", fontSize: 13 }}>
                        {record.nextFollowUpAt ? new Date(record.nextFollowUpAt).toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            title="Editar"
                            onClick={() => void handleEdit(record)}
                            disabled={loadingDetail && editingRecord?.customerId === record.customerId}
                            style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                          >
                            <FilePen size={14} />
                          </button>
                          <button
                            title={record.profileId ? "Ver cliente" : "Completar perfil"}
                            onClick={() => void goToCustomer(record)}
                            disabled={creatingProfileForId === record.customerId}
                            style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="ha-cardlist">
            {list.map((record) => {
              const dias = record.daysSinceLastContact;
              return (
                <div key={record.customerId} className="ha-ordcard">
                  <div className="ha-ordcard__top">
                    <div>
                      <button
                        onClick={() => void goToCustomer(record)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        <div className="ha-ordcard__name">{record.customerName}</div>
                      </button>
                      {record.contactName && (
                        <div style={{ fontSize: 12, color: "var(--ha-text-3)", marginTop: 2 }}>{record.contactName}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => void handleEdit(record)}
                        style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 8, color: "var(--ha-text-2)", cursor: "pointer" }}
                      >
                        <FilePen size={15} />
                      </button>
                      <button
                        onClick={() => void goToCustomer(record)}
                        style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 8, color: "var(--ha-text-2)", cursor: "pointer" }}
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="ha-ordcard__grid">
                    <div>
                      <div className="ha-kv__l">Estado</div>
                      <div className="ha-kv__v">{statusBadge(record.status)}</div>
                    </div>
                    <div>
                      <div className="ha-kv__l">Tipo</div>
                      <div className="ha-kv__v">{tipoBadge(record.customerType)}</div>
                    </div>
                    {record.responsibleName && (
                      <div>
                        <div className="ha-kv__l">Responsable</div>
                        <div className="ha-kv__v" style={{ color: "var(--ha-text-2)" }}>{record.responsibleName}</div>
                      </div>
                    )}
                    {dias != null && (
                      <div>
                        <div className="ha-kv__l">Sin contacto</div>
                        <div className="ha-kv__v" style={{ color: dias > 30 ? "#f59e0b" : "var(--ha-text-2)" }}>{dias} días</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && (
            <Paginator
              page={pagination.page}
              totalPages={meta.totalPages}
              total={meta.total}
              label="clientes"
              onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
            />
          )}
        </>
      )}

      {/* FAB — mobile */}
      <button className="ha-fab" onClick={handleCreate} aria-label="Nuevo cliente">
        <Plus size={24} />
      </button>

      {/* Mobile filter sheet */}
      {filterSheetOpen && (
        <>
          <div className="ha-sheet-back" onClick={() => setFilterSheetOpen(false)} />
          <div className="ha-sheet">
            <div className="ha-sheet__handle" />
            <div className="ha-sheet__head">
              <span className="ha-sheet__title">Filtros</span>
              <button className="ha-iconbtn" onClick={() => setFilterSheetOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="ha-sheet__body">
              <div className="ha-field">
                <div style={{ position: "relative" }}>
                  <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ha-text-3)", pointerEvents: "none" }} />
                  <input
                    className="ha-input"
                    style={{ paddingLeft: 36 }}
                    placeholder="Buscar por nombre, contacto…"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="ha-field" style={{ marginTop: 12 }}>
                <select className="ha-input ha-select" value={draftCustomerType} onChange={(e) => setDraftCustomerType(e.target.value)}>
                  <option value="">Tipo de cliente</option>
                  {CRM_CUSTOMER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginTop: 12 }}>
                <select className="ha-input ha-select" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
                  <option value="">Estado del contacto</option>
                  {CRM_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginTop: 12 }}>
                <select className="ha-input ha-select" value={draftSource} onChange={(e) => setDraftSource(e.target.value)}>
                  <option value="">Origen</option>
                  {CRM_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ha-field" style={{ marginTop: 12 }}>
                <select className="ha-input ha-select" value={draftResponsibleId} onChange={(e) => setDraftResponsibleId(e.target.value)}>
                  <option value="">Responsable</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="ha-sheet__foot">
              <button className="ha-btn ha-btn--primary" onClick={applyFilters}>
                Aplicar filtros
              </button>
            </div>
          </div>
        </>
      )}

      {/* Drawer — create / edit */}
      {drawerOpen && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="ha-drawer" style={{ width: "min(90vw, 520px)" }}>
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">{editingRecord ? "Editar cliente" : "Nuevo cliente"}</span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="ha-drawer__body">
              <div className="ha-formgrid">
                <div className="ha-field">
                  <label className="ha-label">Tipo de cliente</label>
                  <select className="ha-input" value={fCustomerType} onChange={(e) => setFCustomerType(e.target.value)}>
                    <option value="">Empresa o particular</option>
                    {customerTypeFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="ha-field">
                  <label className="ha-label">Nombre o razón social <span style={{ color: "var(--ha-red)" }}>*</span></label>
                  <input className="ha-input" placeholder="Empresa: razón social. Particular: nombre y apellido" value={fName} onChange={(e) => setFName(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Persona de contacto (opcional)</label>
                  <input className="ha-input" placeholder="En empresas: quién atiende" value={fContactName} onChange={(e) => setFContactName(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Teléfono</label>
                  <input className="ha-input" placeholder="Teléfono de contacto" value={fPhone} onChange={(e) => setFPhone(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Email</label>
                  <input type="email" className="ha-input" placeholder="Email de contacto" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Estado del contacto</label>
                  <select className="ha-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                    <option value="">Seleccioná un estado</option>
                    {statusFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="ha-field">
                  <label className="ha-label">¿De dónde nos conoció? (origen del cliente)</label>
                  <select className="ha-input" value={fSource} onChange={(e) => setFSource(e.target.value)}>
                    <option value="">Elegí un origen</option>
                    {sourceFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="ha-field">
                  <label className="ha-label">Socio responsable del seguimiento (opcional)</label>
                  <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "var(--ha-text-3)" }}>
                    Quién lleva o consiguió este cliente.
                  </p>
                  <select className="ha-input" value={fResponsibleId} onChange={(e) => setFResponsibleId(e.target.value)}>
                    <option value="">Ninguno</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="ha-field">
                  <label className="ha-label">Notas generales</label>
                  <textarea className="ha-input" rows={2} placeholder="Anotaciones sobre el cliente" value={fGeneralNotes} onChange={(e) => setFGeneralNotes(e.target.value)} style={{ resize: "vertical" }} />
                </div>
                <div className="ha-field">
                  <label className="ha-label">Fecha del próximo seguimiento</label>
                  <input type="date" className="ha-input" value={fNextFollowUpAt} onChange={(e) => setFNextFollowUpAt(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="ha-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeDrawer}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Guardando…" : editingRecord ? "Guardar" : "Crear"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
