"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { useLineContext } from "@/lib/line-context";
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from "@/lib/types";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export default function CategoriesPage() {
  return (
    <AppLayout>
      <CategoriesContent />
    </AppLayout>
  );
}

type Toast = { msg: string; type: "success" | "error" };

function CategoriesContent() {
  const { selectedLineId } = useLineContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState("");
  const [nameErr, setNameErr] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCategories(1, 100, selectedLineId ?? undefined);
      setCategories(response.data);
    } catch {
      showToast("Error al cargar categorías", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedLineId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (drawerOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [drawerOpen]);

  const openCreate = () => {
    if (!selectedLineId) { showToast("Seleccioná una línea de negocio", "error"); return; }
    setEditingId(null);
    setDrawerName("");
    setNameErr(false);
    setDrawerOpen(true);
  };

  const openEdit = (record: Category) => {
    setEditingId(record.id);
    setDrawerName(record.name);
    setNameErr(false);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    setDrawerName("");
    setNameErr(false);
  };

  const saveDrawer = async () => {
    const trimmed = drawerName.trim();
    if (!trimmed) { setNameErr(true); nameInputRef.current?.focus(); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await apiClient.updateCategory(editingId, { name: trimmed } as UpdateCategoryRequest);
        showToast("Categoría actualizada", "success");
      } else {
        const payload: CreateCategoryRequest = { businessLineId: selectedLineId!, name: trimmed };
        await apiClient.createCategory(payload);
        showToast("Categoría creada", "success");
      }
      closeDrawer();
      fetchCategories();
    } catch {
      showToast("Error al guardar categoría", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (cat: Category) => {
    setDeleteId(cat.id);
    setDeleteTarget(cat.name);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiClient.deleteCategory(deleteId);
      showToast("Categoría eliminada", "success");
      setDeleteId(null);
      fetchCategories();
    } catch {
      showToast("Error al eliminar categoría", "error");
      setDeleteId(null);
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 100,
          background: toast.type === "success" ? "var(--ha-green-soft)" : "var(--ha-red-soft)",
          color: toast.type === "success" ? "var(--ha-green)" : "var(--ha-red)",
          border: "1px solid", borderColor: toast.type === "success" ? "var(--ha-green)" : "var(--ha-red)",
          borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,.3)",
          animation: "ha-scalein .2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Categorías</h1>
        <button className="ha-btn ha-btn--primary" onClick={openCreate} disabled={!selectedLineId}>
          <Plus size={15} /> Nueva categoría
        </button>
      </div>

      {/* Search */}
      <div className="ha-filters" style={{ marginBottom: 16 }}>
        <div className="ha-filters__row">
          <input
            className="ha-filter-input"
            style={{ flex: 1, maxWidth: 320 }}
            placeholder="Buscar categorías…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

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
          <p className="ha-empty__t">Sin categorías</p>
          <p className="ha-empty__s">
            {search ? "Ninguna categoría coincide con la búsqueda." : "Creá la primera categoría usando el botón de arriba."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th style={{ width: 100, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat, i) => (
                  <tr key={cat.id}>
                    <td className="ha-mono" style={{ color: "var(--ha-text-3)", width: 44 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{cat.name}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          className="ha-actbtn"
                          onClick={() => openEdit(cat)}
                          aria-label="Editar"
                          style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 7, color: "var(--ha-text-2)", cursor: "pointer" }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => openDelete(cat)}
                          aria-label="Eliminar"
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
            {filtered.map((cat) => (
              <div key={cat.id} className="ha-ordcard">
                <div className="ha-ordcard__top">
                  <span className="ha-ordcard__name">{cat.name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => openEdit(cat)}
                      aria-label="Editar"
                      style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--ha-border-2)", background: "transparent", borderRadius: 8, color: "var(--ha-text-2)", cursor: "pointer" }}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => openDelete(cat)}
                      aria-label="Eliminar"
                      style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--ha-red)", background: "transparent", borderRadius: 8, color: "var(--ha-red)", cursor: "pointer" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* FAB — mobile */}
      <button className="ha-fab" onClick={openCreate} aria-label="Nueva categoría">
        <Plus size={24} />
      </button>

      {/* Drawer — create / edit */}
      {drawerOpen && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="ha-drawer">
            <div className="ha-sheet__handle" />
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">{editingId ? "Editar categoría" : "Nueva categoría"}</span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="ha-drawer__body">
              <div className="ha-field">
                <label className="ha-label">
                  Nombre <span style={{ color: "var(--ha-red)" }}>*</span>
                </label>
                <input
                  ref={nameInputRef}
                  className={`ha-input${nameErr ? " ha-input--error" : ""}`}
                  placeholder="Ej: Cervezas Artesanales"
                  value={drawerName}
                  onChange={(e) => { setDrawerName(e.target.value); if (nameErr) setNameErr(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") saveDrawer(); }}
                />
                {nameErr && <span className="ha-error">El nombre es obligatorio.</span>}
              </div>
            </div>
            <div className="ha-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeDrawer}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={saveDrawer} disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="ha-dialog-back" onClick={() => setDeleteId(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar categoría?</h3>
              <p className="ha-dialog__sub">Esta acción no puede deshacerse.</p>
            </div>
            <div className="ha-dialog__body">
              <p style={{ color: "var(--ha-text-2)", margin: 0, fontSize: 14 }}>
                Se eliminará la categoría <strong style={{ color: "var(--ha-text)" }}>{deleteTarget}</strong>.
              </p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
