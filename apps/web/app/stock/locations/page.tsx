"use client";

import { AppLayout } from "@/components/app-layout";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { LocationStockModal } from "@/components/stock/location-stock-modal";
import { apiClient } from "@/lib/api-client";
import { useLineContext } from "@/lib/line-context";
import type { StockBalanceRow, StockLocation } from "@/lib/types";
import { ArrowLeftRight, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Toast = { type: "success" | "error" | "info"; msg: string };

export default function StockLocationsPage() {
  return (
    <AppLayout>
      <StockLocationsContent />
    </AppLayout>
  );
}

function StockLocationsContent() {
  const { selectedLineId } = useLineContext();
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (t: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  type DrawerMode = "create" | "edit" | "transfer" | null;
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [editingLocation, setEditingLocation] = useState<StockLocation | null>(null);
  const [transferFromLocation, setTransferFromLocation] = useState<StockLocation | null>(null);

  const [fname, setFname] = useState("");
  const [fisDefault, setFisDefault] = useState(false);
  const [fnameErr, setFnameErr] = useState(false);
  const [fTransferTo, setFTransferTo] = useState("");
  const [fTransferErr, setFTransferErr] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<StockLocation | null>(null);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingLocation, setViewingLocation] = useState<StockLocation | null>(null);
  const [viewBalances, setViewBalances] = useState<StockBalanceRow[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLocations(await apiClient.getStockLocations());
    } catch {
      showToast({ type: "error", msg: "Error al cargar ubicaciones" });
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setFname(""); setFisDefault(false); setFnameErr(false);
    setDrawerMode("create");
  };

  const openEdit = (loc: StockLocation) => {
    setEditingLocation(loc);
    setFname(loc.name); setFisDefault(loc.isDefault); setFnameErr(false);
    setDrawerMode("edit");
  };

  const openTransfer = (loc: StockLocation) => {
    setTransferFromLocation(loc);
    setFTransferTo(""); setFTransferErr(false);
    setDrawerMode("transfer");
  };

  const closeDrawer = () => {
    setDrawerMode(null); setEditingLocation(null); setTransferFromLocation(null);
  };

  const openView = async (loc: StockLocation) => {
    setViewingLocation(loc); setViewModalOpen(true); setViewLoading(true); setViewBalances([]);
    try {
      const rows = await apiClient.getStockBalancesAtLocation(loc.id, selectedLineId ?? undefined);
      setViewBalances(rows);
    } catch {
      showToast({ type: "error", msg: "No se pudo cargar el stock de la ubicación" });
    } finally {
      setViewLoading(false);
    }
  };

  const saveLocation = async () => {
    if (!fname.trim()) { setFnameErr(true); return; }
    setFnameErr(false); setSubmitting(true);
    try {
      if (drawerMode === "create") {
        await apiClient.createStockLocation({ name: fname.trim(), isDefault: fisDefault });
        showToast({ type: "success", msg: "Ubicación creada" });
      } else if (editingLocation) {
        await apiClient.updateStockLocation(editingLocation.id, { name: fname.trim(), isDefault: fisDefault });
        showToast({ type: "success", msg: "Ubicación actualizada" });
      }
      closeDrawer();
      await load();
    } catch {
      showToast({ type: "error", msg: "No se pudo guardar la ubicación" });
    } finally {
      setSubmitting(false);
    }
  };

  const doTransfer = async () => {
    if (!fTransferTo || !transferFromLocation) { setFTransferErr(true); return; }
    setFTransferErr(false); setSubmitting(true);
    try {
      const res = await apiClient.transferAllStockBetweenLocations(transferFromLocation.id, {
        toLocationId: fTransferTo,
      });
      if (res.movementsCreated === 0) {
        showToast({ type: "info", msg: res.message ?? "No había stock para mover en el origen" });
      } else {
        showToast({ type: "success", msg: `Traspasados ${res.movementsCreated} productos` });
      }
      closeDrawer();
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      showToast({ type: "error", msg: msg || "No se pudo completar el traspaso" });
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const loc = confirmDelete;
    setConfirmDelete(null);
    try {
      await apiClient.deleteStockLocation(loc.id);
      showToast({ type: "success", msg: "Ubicación eliminada" });
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      showToast({ type: "error", msg: msg || "No se pudo eliminar la ubicación" });
    }
  };

  return (
    <div>
      {toast && (
        <div
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 200,
            padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 500,
            background: toast.type === "success"
              ? "var(--ha-green-soft)" : toast.type === "info"
              ? "var(--ha-amber-soft)" : "var(--ha-red-soft)",
            color: toast.type === "success"
              ? "var(--ha-green)" : toast.type === "info"
              ? "var(--ha-amber)" : "var(--ha-red)",
            border: "1px solid",
            borderColor: toast.type === "success"
              ? "var(--ha-green)" : toast.type === "info"
              ? "var(--ha-amber)" : "var(--ha-red)",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="ha-page-header">
        <h1 className="ha-pagetitle">Ubicaciones de stock</h1>
        <button className="ha-btn ha-btn--primary" onClick={openCreate}>
          <Plus size={15} /> Nueva ubicación
        </button>
      </div>

      <ScreenInfoPanel title="Cómo funcionan las ubicaciones de stock">
        <div>
          <p style={{ margin: "0 0 8px 0" }}>
            Cada ubicación es un depósito o lugar donde tenés inventario. Los movimientos y pedidos
            eligen desde cuál se descuenta o hacia cuál ingresa.
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            Usá la <strong>misma unidad</strong> de cantidad que definiste al cargar el producto.
          </p>
          <p style={{ margin: 0 }}>
            Podés <strong>traspasar todo el stock</strong> para consolidar depósitos. Solo podés
            eliminar una ubicación si no tiene stock.
          </p>
        </div>
      </ScreenInfoPanel>

      {loading ? (
        <div className="ha-empty"><span className="ha-empty__t">Cargando...</span></div>
      ) : (
        <>
          <div className="ha-table-wrap">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Predeterminada</th>
                  <th>Alta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td>{loc.name}</td>
                    <td>
                      <span className={`ha-badge ${loc.isDefault ? "ha-badge--paid" : "ha-badge--draft"}`}>
                        {loc.isDefault ? "Sí" : "No"}
                      </span>
                    </td>
                    <td>{new Date(loc.createdAt).toLocaleDateString("es-AR")}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="ha-btn ha-btn--sm" title="Ver stock" onClick={() => openView(loc)}>
                          <Eye size={13} />
                        </button>
                        <button className="ha-btn ha-btn--sm ha-btn--primary" title="Editar" onClick={() => openEdit(loc)}>
                          <Pencil size={13} />
                        </button>
                        <button
                          className="ha-btn ha-btn--sm"
                          title="Traspasar todo"
                          disabled={locations.length < 2}
                          onClick={() => openTransfer(loc)}
                        >
                          <ArrowLeftRight size={13} />
                        </button>
                        <button
                          className="ha-btn ha-btn--sm ha-btn--destructive"
                          title="Eliminar"
                          onClick={() => setConfirmDelete(loc)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ha-cardlist">
            {locations.map((loc) => (
              <div key={loc.id} className="ha-ordcard">
                <div className="ha-ordcard__header">
                  <span className="ha-ordcard__id">{loc.name}</span>
                  {loc.isDefault && <span className="ha-badge ha-badge--paid">Predeterminada</span>}
                </div>
                <div className="ha-ordcard__meta">
                  Alta: {new Date(loc.createdAt).toLocaleDateString("es-AR")}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="ha-btn ha-btn--sm" onClick={() => openView(loc)}>
                    <Eye size={13} /> Ver stock
                  </button>
                  <button className="ha-btn ha-btn--sm ha-btn--primary" onClick={() => openEdit(loc)}>
                    <Pencil size={13} />
                  </button>
                  <button
                    className="ha-btn ha-btn--sm"
                    disabled={locations.length < 2}
                    onClick={() => openTransfer(loc)}
                  >
                    <ArrowLeftRight size={13} />
                  </button>
                  <button
                    className="ha-btn ha-btn--sm ha-btn--destructive"
                    onClick={() => setConfirmDelete(loc)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit drawer */}
      {(drawerMode === "create" || drawerMode === "edit") && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="ha-drawer">
            <div className="ha-sheet__handle" />
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">
                {drawerMode === "create" ? "Nueva ubicación" : `Editar: ${editingLocation?.name}`}
              </span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="ha-drawer__body">
              <div className="ha-field">
                <label className="ha-label">Nombre <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input
                  className={`ha-input${fnameErr ? " ha-input--error" : ""}`}
                  value={fname}
                  onChange={(e) => { setFname(e.target.value); if (fnameErr) setFnameErr(false); }}
                  placeholder="Ej. Local, Casa Centro, Depósito Norte"
                  autoFocus
                />
                {fnameErr && <span className="ha-error">Ingresá un nombre</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
                <input
                  type="checkbox"
                  id="chk-default"
                  checked={fisDefault}
                  onChange={(e) => setFisDefault(e.target.checked)}
                />
                <label htmlFor="chk-default" className="ha-label" style={{ margin: 0 }}>
                  Marcar como ubicación predeterminada
                </label>
              </div>
            </div>
            <div className="ha-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeDrawer}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={saveLocation} disabled={submitting}>
                {submitting ? "Guardando…" : drawerMode === "create" ? "Guardar" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Transfer drawer */}
      {drawerMode === "transfer" && (
        <>
          <div className="ha-overlay" onClick={closeDrawer} />
          <div className="ha-drawer">
            <div className="ha-sheet__handle" />
            <div className="ha-drawer__head">
              <span className="ha-drawer__title">
                Traspasar todo desde «{transferFromLocation?.name}»
              </span>
              <button className="ha-iconbtn" onClick={closeDrawer} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="ha-drawer__body">
              <p style={{ color: "var(--ha-text-3)", marginBottom: 16, fontSize: 14 }}>
                Se mueven todas las cantidades distintas de cero del origen al destino. El total por
                producto no cambia; queda registro en movimientos de stock.
              </p>
              <div className="ha-field">
                <label className="ha-label">Ubicación destino</label>
                <select
                  className={`ha-select${fTransferErr ? " ha-input--error" : ""}`}
                  value={fTransferTo}
                  onChange={(e) => { setFTransferTo(e.target.value); if (fTransferErr) setFTransferErr(false); }}
                >
                  <option value="">Elegí el destino</option>
                  {locations
                    .filter((l) => l.id !== transferFromLocation?.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}{l.isDefault ? " (predeterminada)" : ""}
                      </option>
                    ))}
                </select>
                {fTransferErr && <span className="ha-error">Elegí el destino</span>}
              </div>
            </div>
            <div className="ha-drawer__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeDrawer}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={doTransfer} disabled={submitting}>
                {submitting ? "Traspasando…" : "Traspasar todo"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="ha-dialog-back" onClick={() => setConfirmDelete(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar esta ubicación?</h3>
              <p className="ha-dialog__sub">
                Solo se puede si no hay stock. Los movimientos viejos quedarán sin ubicación.
              </p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button className="ha-btn ha-btn--destructive" onClick={doDelete}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <LocationStockModal
        open={viewModalOpen}
        locationName={viewingLocation?.name ?? null}
        loading={viewLoading}
        balances={viewBalances}
        onClose={() => {
          setViewModalOpen(false);
          setViewingLocation(null);
          setViewBalances([]);
        }}
      />
    </div>
  );
}
