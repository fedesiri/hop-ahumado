"use client";

import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { CreateUserRequest, UpdateUserRequest, User } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Paginator } from "@/components/paginator";
import { Spinner } from "@/components/spinner";
import { CheckCircle2, Edit2, Eye, EyeOff, Plus, Trash2, XCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "")).toUpperCase() + ((parts[1]?.[0] ?? "")).toUpperCase();
}

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
  const [page, setPage] = useState(1);
  const limit = 10;
  const [total, setTotal] = useState(0);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = useState("");

  // Form
  const [fname, setFname] = useState("");
  const [femail, setFemail] = useState("");
  const [fpassword, setFpassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async (p = page) => {
    try {
      setLoading(true);
      const res = await apiClient.getUsers(p, limit);
      setUsers(res.data);
      setTotal(res.meta.total);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async () => {
    try {
      const h = await apiClient.checkHealth();
      setApiOk(true);
      setHealthStatus(h.status ?? "ok");
    } catch {
      setApiOk(false);
      setHealthStatus("offline");
    }
  };

  useEffect(() => {
    void fetchUsers(page);
    void checkHealth();
  }, [page]);

  useEffect(() => {
    if (drawerOpen) setTimeout(() => nameRef.current?.focus(), 80);
  }, [drawerOpen]);

  const openCreate = () => {
    setEditingId(null);
    setFname(""); setFemail(""); setFpassword(""); setShowPass(false); setErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingId(u.id);
    setFname(u.name ?? ""); setFemail(u.email ?? ""); setFpassword(""); setShowPass(false); setErrors({});
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditingId(null); };

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
        await apiClient.createUser({ name: fname.trim(), email: femail.trim(), password: fpassword } as CreateUserRequest);
        toast.success("Usuario creado");
      }
      closeDrawer();
      void fetchUsers(page);
    } catch {
      toast.error("Error al guardar usuario");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiClient.deleteUser(deleteId);
      toast.success("Usuario eliminado");
      setDeleteId(null);
      void fetchUsers(page);
    } catch {
      toast.error("Error al eliminar usuario");
      setDeleteId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>Usuarios</h1>
        <button className="pc-btn pc-btn--primary us-newbtn" onClick={openCreate}>
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      {/* Health card */}
      <div className={"us-health" + (apiOk === false ? " off" : "")}>
        <div className="us-health__row">
          <div className="us-stat">
            <div className={"us-stat__ic" + (apiOk === false ? " r" : " g")}>
              {apiOk === false
                ? <XCircle size={18} />
                : <CheckCircle2 size={18} />}
            </div>
            <div>
              <div className={"us-stat__v" + (apiOk === false ? " r" : " g")}>
                {apiOk === null ? "Verificando…" : apiOk ? "En línea" : "Fuera de línea"}
              </div>
              <div className="us-stat__l">Estado del servidor</div>
            </div>
          </div>
          <div className="us-stat">
            <div>
              <div className="us-stat__v">{total}</div>
              <div className="us-stat__l">Usuarios registrados</div>
            </div>
          </div>
        </div>
        {healthStatus && (
          <div className="us-health__foot">
            <span className="us-health__status">Status: {healthStatus}</span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState title="Sin usuarios" subtitle="Creá el primer usuario con el botón de arriba." />
      ) : (
        <div className="us-card">
          {/* Desktop table */}
          <div className="us-tablewrap">
            <table className="us-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Fecha de creación</th>
                  <th className="r">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="us-uname">
                        <div className="us-uav">{initials(u.name ?? u.email ?? "?")}</div>
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                      </div>
                    </td>
                    <td><span className="us-uemail">{u.email}</span></td>
                    <td><span className="us-udate">{new Date(u.createdAt).toLocaleDateString("es-AR")}</span></td>
                    <td>
                      <div className="us-acts">
                        <button className="us-actbtn" onClick={() => openEdit(u)} aria-label="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="us-actbtn us-actbtn--del"
                          onClick={() => { setDeleteId(u.id); setDeleteTarget(u.name ?? u.email ?? ""); }}
                          aria-label="Eliminar"
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

          {/* Mobile cards */}
          <div className="us-cardlist" style={{ padding: 12 }}>
            {users.map((u) => (
              <div key={u.id} className="us-ucard">
                <div className="us-ucard__top">
                  <div className="us-uav">{initials(u.name ?? u.email ?? "?")}</div>
                  <span className="us-ucard__name">{u.name}</span>
                  <div className="us-ucard__acts">
                    <button className="us-actbtn" onClick={() => openEdit(u)} aria-label="Editar"><Edit2 size={14} /></button>
                    <button
                      className="us-actbtn us-actbtn--del"
                      onClick={() => { setDeleteId(u.id); setDeleteTarget(u.name ?? u.email ?? ""); }}
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="us-ucard__email">{u.email}</div>
                <div className="us-ucard__date">Creado: {new Date(u.createdAt).toLocaleDateString("es-AR")}</div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <Paginator
            page={page}
            totalPages={totalPages}
            total={total}
            label="usuarios"
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Mobile FAB */}
      <button className="us-fab" onClick={openCreate} aria-label="Nuevo usuario">
        <Plus size={22} />
      </button>

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="us-drawer">
            <div className="us-handle" />
            <div className="us-drawer__head">
              <span className="us-drawer__title">{editingId ? "Editar usuario" : "Nuevo usuario"}</span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="us-drawer__body">
              <div className="us-field">
                <label className="us-label">Nombre <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input
                  ref={nameRef}
                  className={"us-input" + (errors.name ? " has-err" : "")}
                  placeholder="Nombre del usuario"
                  value={fname}
                  onChange={(e) => { setFname(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                />
                {errors.name && <span className="us-err">{errors.name}</span>}
              </div>
              <div className="us-field">
                <label className="us-label">Email <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input
                  className={"us-input" + (errors.email ? " has-err" : "")}
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={femail}
                  onChange={(e) => { setFemail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                />
                {errors.email && <span className="us-err">{errors.email}</span>}
              </div>
              {!editingId ? (
                <div className="us-field">
                  <label className="us-label">Contraseña <span style={{ color: "var(--ha-red)" }}>*</span></label>
                  <div className="us-inputwrap">
                    <input
                      className={"us-input us-input--pass" + (errors.password ? " has-err" : "")}
                      type={showPass ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      value={fpassword}
                      onChange={(e) => { setFpassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                    />
                    <button className="us-eye" type="button" onClick={() => setShowPass((v) => !v)} aria-label="Mostrar contraseña">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password
                    ? <span className="us-err">{errors.password}</span>
                    : <span className="us-hint">Mínimo 6 caracteres. Usada para acceder con Firebase Auth.</span>}
                </div>
              ) : (
                <div className="us-hint" style={{ marginBottom: 12 }}>
                  Para cambiar la contraseña, el usuario debe hacerlo desde Firebase directamente.
                </div>
              )}
            </div>
            <div className="us-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeDrawer}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Guardando…" : editingId ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <ConfirmDialog
          title="¿Eliminar usuario?"
          description={<>Se eliminará la cuenta de <strong>{deleteTarget}</strong>. Esta acción no puede deshacerse.</>}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  );
}
