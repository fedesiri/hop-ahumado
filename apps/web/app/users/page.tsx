"use client";

import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { CreateUserRequest, HealthResponse, UpdateUserRequest, User } from "@/lib/types";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function UsersPage() {
  return <UsersContent />;
}

function UsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [apiHealthOk, setApiHealthOk] = useState(false);

  // form fields
  const [fname, setFname] = useState("");
  const [femail, setFemail] = useState("");
  const [fpassword, setFpassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
    checkApiHealth();
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    if (drawerOpen) setTimeout(() => nameRef.current?.focus(), 80);
  }, [drawerOpen]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers(pagination.page, pagination.limit);
      setUsers(response.data);
      setMeta(response.meta);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const checkApiHealth = async () => {
    try {
      const health = await apiClient.checkHealth();
      setHealthStatus(health);
      setApiHealthOk(true);
    } catch {
      setApiHealthOk(false);
    }
  };

  const resetForm = () => {
    setFname(""); setFemail(""); setFpassword(""); setErrors({});
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (record: User) => {
    setEditingId(record.id);
    setFname(record.name ?? "");
    setFemail(record.email ?? "");
    setFpassword("");
    setErrors({});
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    resetForm();
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fname.trim()) errs.name = "El nombre es requerido";
    if (!femail.trim()) errs.email = "El email es requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(femail)) errs.email = "Email inválido";
    if (!editingId) {
      if (!fpassword) errs.password = "La contraseña es requerida";
      else if (fpassword.length < 6) errs.password = "Mínimo 6 caracteres";
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await apiClient.updateUser(editingId, { name: fname.trim(), email: femail.trim() } as UpdateUserRequest);
        toast.success("Usuario actualizado");
      } else {
        const data: CreateUserRequest = { name: fname.trim(), email: femail.trim(), password: fpassword };
        await apiClient.createUser(data);
        toast.success("Usuario creado");
      }
      closeDrawer();
      fetchUsers();
    } catch {
      toast.error("Error al guardar usuario");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Usuarios</h1>
        <button className="ha-btn ha-btn--primary" onClick={openCreate}>
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      {/* API health card */}
      <div style={{
        background: "var(--ha-bg-card)",
        border: `1px solid ${apiHealthOk ? "var(--ha-green)" : "var(--ha-red)"}`,
        borderLeft: `4px solid ${apiHealthOk ? "var(--ha-green)" : "var(--ha-red)"}`,
        borderRadius: 10, padding: "14px 18px", marginBottom: 20,
        display: "flex", gap: 32, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ha-text-3)", marginBottom: 4 }}>Estado de la API</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: apiHealthOk ? "var(--ha-green)" : "var(--ha-red)" }}>
            {apiHealthOk ? "En línea" : "Fuera de línea"}
          </div>
          {healthStatus && <div style={{ fontSize: 11, color: "var(--ha-text-3)", marginTop: 2 }}>Status: {healthStatus.status}</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ha-text-3)", marginBottom: 4 }}>Total usuarios</div>
          <div className="ha-mono" style={{ fontWeight: 700, fontSize: 18, color: "var(--ha-text)" }}>{meta?.total ?? users.length}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
        </div>
      ) : users.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">Sin usuarios</p>
          <p className="ha-empty__s">Creá el primer usuario.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Creado</th>
                  <th style={{ textAlign: "right", width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td style={{ color: "var(--ha-text-2)" }}>{u.email}</td>
                    <td className="ha-mono" style={{ color: "var(--ha-text-2)" }}>
                      {new Date(u.createdAt).toLocaleDateString("es-AR")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          onClick={() => openEdit(u)}
                          style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => { setDeleteId(u.id); setDeleteTarget(u.name ?? u.email); }}
                          style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 7, color: "var(--ha-red)", cursor: "pointer" }}
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

          {/* Mobile card list */}
          <div className="ha-cardlist">
            {users.map((u) => (
              <div key={u.id} className="ha-ordcard">
                <div className="ha-ordcard__top">
                  <span className="ha-ordcard__name">{u.name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(u)} style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 8, color: "var(--ha-text-2)", cursor: "pointer" }}>
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => { setDeleteId(u.id); setDeleteTarget(u.name ?? u.email); }} style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 8, color: "var(--ha-red)", cursor: "pointer" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--ha-text-3)", marginTop: 4 }}>{u.email}</div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.total > pagination.limit && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
                Anterior
              </button>
              <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: "var(--ha-text-3)" }}>
                {pagination.page} / {Math.ceil(meta.total / pagination.limit)}
              </span>
              <button className="ha-btn ha-btn--secondary ha-btn--sm" disabled={pagination.page * pagination.limit >= meta.total} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="ha-drawer">
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">{editingId ? "Editar usuario" : "Nuevo usuario"}</span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="ha-drawer__body">
              <div className="ha-formgrid">
                <div className="ha-field">
                  <label className="ha-label">Nombre <span style={{ color: "var(--ha-red)" }}>*</span></label>
                  <input ref={nameRef} className={`ha-input${errors.name ? " ha-input--error" : ""}`} placeholder="Nombre del usuario" value={fname} onChange={(e) => { setFname(e.target.value); setErrors((p) => ({ ...p, name: "" })); }} />
                  {errors.name && <span className="ha-error">{errors.name}</span>}
                </div>
                <div className="ha-field">
                  <label className="ha-label">Email <span style={{ color: "var(--ha-red)" }}>*</span></label>
                  <input className={`ha-input${errors.email ? " ha-input--error" : ""}`} type="email" placeholder="correo@ejemplo.com" value={femail} onChange={(e) => { setFemail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }} />
                  {errors.email && <span className="ha-error">{errors.email}</span>}
                </div>
                {!editingId && (
                  <div className="ha-field">
                    <label className="ha-label">Contraseña <span style={{ color: "var(--ha-red)" }}>*</span></label>
                    <input className={`ha-input${errors.password ? " ha-input--error" : ""}`} type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={fpassword} onChange={(e) => { setFpassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }} />
                    {errors.password && <span className="ha-error">{errors.password}</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="ha-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeDrawer}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar usuario?</h3>
              <p className="ha-dialog__sub">Esta acción no puede deshacerse.</p>
            </div>
            <div className="ha-dialog__body">
              <p style={{ color: "var(--ha-text-2)", margin: 0, fontSize: 14 }}>
                Se eliminará <strong style={{ color: "var(--ha-text)" }}>{deleteTarget}</strong>.
              </p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={async () => {
                try {
                  await apiClient.deleteUser(deleteId!);
                  toast.success("Usuario eliminado");
                  setDeleteId(null);
                  fetchUsers();
                } catch {
                  toast.error("Error al eliminar usuario");
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
