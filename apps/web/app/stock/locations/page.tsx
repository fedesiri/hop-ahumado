"use client";

import { LocationStockModal } from "@/components/stock/location-stock-modal";
import { apiClient } from "@/lib/api-client";
import { useLineContext } from "@/lib/line-context";
import type { StockBalanceRow, StockLocation } from "@/lib/types";
import { toast } from "@/lib/toast";
import { ArrowLeftRight, Eye, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function StockLocationsPage() {
  return <StockLocationsContent />;
}

function StockLocationsContent() {
  const { selectedLineId } = useLineContext();
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stockCounts, setStockCounts] = useState<Record<string, number>>({});

  type ModalMode = "create" | "edit" | "transfer" | null;
  const [modalMode, setModalMode] = useState<ModalMode>(null);
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

  const fetchStockCounts = useCallback(async (locs: StockLocation[]) => {
    const counts: Record<string, number> = {};
    await Promise.all(
      locs.map(async (loc) => {
        try {
          const rows = await apiClient.getStockBalancesAtLocation(loc.id, selectedLineId ?? undefined);
          counts[loc.id] = rows.filter((r) => Number(r.quantity) > 0).length;
        } catch {
          counts[loc.id] = 0;
        }
      })
    );
    setStockCounts(counts);
  }, [selectedLineId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const locs = await apiClient.getStockLocations();
      setLocations(locs);
      void fetchStockCounts(locs);
    } catch {
      toast.error("Error al cargar ubicaciones");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [fetchStockCounts]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setFname(""); setFisDefault(false); setFnameErr(false);
    setModalMode("create");
  };

  const openEdit = (loc: StockLocation) => {
    setEditingLocation(loc);
    setFname(loc.name); setFisDefault(loc.isDefault); setFnameErr(false);
    setModalMode("edit");
  };

  const openTransfer = (loc: StockLocation) => {
    setTransferFromLocation(loc);
    setFTransferTo(""); setFTransferErr(false);
    setModalMode("transfer");
  };

  const closeModal = () => {
    setModalMode(null); setEditingLocation(null); setTransferFromLocation(null);
  };

  const openView = async (loc: StockLocation) => {
    setViewingLocation(loc); setViewModalOpen(true); setViewLoading(true); setViewBalances([]);
    try {
      const rows = await apiClient.getStockBalancesAtLocation(loc.id, selectedLineId ?? undefined);
      setViewBalances(rows);
    } catch {
      toast.error("No se pudo cargar el stock de la ubicación");
    } finally {
      setViewLoading(false);
    }
  };

  const saveLocation = async () => {
    if (!fname.trim()) { setFnameErr(true); return; }
    setFnameErr(false); setSubmitting(true);
    try {
      if (modalMode === "create") {
        await apiClient.createStockLocation({ name: fname.trim(), isDefault: fisDefault });
        toast.success("Ubicación creada");
      } else if (editingLocation) {
        await apiClient.updateStockLocation(editingLocation.id, { name: fname.trim(), isDefault: fisDefault });
        toast.success("Ubicación actualizada");
      }
      closeModal();
      await load();
    } catch {
      toast.error("No se pudo guardar la ubicación");
    } finally {
      setSubmitting(false);
    }
  };

  const doTransfer = async () => {
    if (!fTransferTo || !transferFromLocation) { setFTransferErr(true); return; }
    setFTransferErr(false); setSubmitting(true);
    try {
      const res = await apiClient.transferAllStockBetweenLocations(transferFromLocation.id, { toLocationId: fTransferTo });
      if (res.movementsCreated === 0) {
        toast.info(res.message ?? "No había stock para mover en el origen");
      } else {
        toast.success(`Traspasados ${res.movementsCreated} productos`);
      }
      closeModal();
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      toast.error(msg || "No se pudo completar el traspaso");
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
      toast.success("Ubicación eliminada");
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      toast.error(msg || "No se pudo eliminar la ubicación");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>Stock · Ubicaciones</h1>
        <button className="pc-btn pc-btn--primary" onClick={openCreate}>
          + Nueva ubicación
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "2px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)",
            animation: "ha-spin .7s linear infinite",
          }} />
        </div>
      ) : locations.length === 0 ? (
        <div className="ha-empty">
          <p className="ha-empty__t">No hay ubicaciones de stock</p>
        </div>
      ) : (
        <div className="pc-card">
          <div style={{ overflowX: "auto" }}>
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Por defecto</th>
                  <th>Creada</th>
                  <th>Productos con stock</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => {
                  const count = stockCounts[loc.id] ?? null;
                  const canDelete = count === 0;
                  return (
                    <tr key={loc.id}>
                      <td style={{ fontWeight: 500 }}>{loc.name}</td>
                      <td>
                        <span className={`sm-badge ${loc.isDefault ? "sm-badge--in" : "sm-badge--off"}`}>
                          {loc.isDefault ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="pc-vig">{new Date(loc.createdAt).toLocaleDateString("es-AR")}</td>
                      <td>
                        {count === null ? (
                          <span className="pc-vig">—</span>
                        ) : (
                          <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, color: count > 0 ? "var(--ha-amber)" : "var(--ha-text-3)" }}>
                            {count} producto{count !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="ul-actrow">
                          <button className="ul-act" title="Ver stock" onClick={() => void openView(loc)}>
                            <Eye size={15} />
                          </button>
                          <button className="ul-act" title="Editar" onClick={() => openEdit(loc)}>
                            <Pencil size={15} />
                          </button>
                          <button
                            className="ul-act"
                            title="Traspasar todo el stock"
                            disabled={locations.length < 2}
                            onClick={() => openTransfer(loc)}
                          >
                            <ArrowLeftRight size={15} />
                          </button>
                          <button
                            className={`ul-act${canDelete ? " ul-act--danger" : ""}`}
                            title={canDelete ? "Eliminar" : "No se puede eliminar: tiene stock"}
                            disabled={!canDelete}
                            onClick={() => setConfirmDelete(loc)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="ha-modal-backdrop" onClick={closeModal}>
          <div className="ha-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">
                {modalMode === "create" ? "Nueva ubicación" : `Editar: ${editingLocation?.name}`}
              </span>
              <button className="ha-iconbtn" onClick={closeModal} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <div className="ha-field" style={{ marginBottom: 16 }}>
                <label className="ha-label">Nombre <span style={{ color: "var(--ha-red)" }}>*</span></label>
                <input
                  className={`ha-input${fnameErr ? " ha-input--error" : ""}`}
                  value={fname}
                  onChange={(e) => { setFname(e.target.value); if (fnameErr) setFnameErr(false); }}
                  placeholder="Ej. Depósito Norte, Local Centro"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                {fnameErr && <span className="ha-error">Ingresá un nombre</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  className={`pc-check${fisDefault ? " on" : ""}`}
                  onClick={() => setFisDefault((v) => !v)}
                  style={{ cursor: "pointer" }}
                >
                  {fisDefault && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <label
                  className="ha-label"
                  style={{ margin: 0, cursor: "pointer" }}
                  onClick={() => setFisDefault((v) => !v)}
                >
                  Marcar como ubicación predeterminada
                </label>
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeModal}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void saveLocation()} disabled={submitting}>
                {submitting ? "Guardando…" : modalMode === "create" ? "Guardar" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {modalMode === "transfer" && (
        <div className="ha-modal-backdrop" onClick={closeModal}>
          <div className="ha-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="ha-modal__head">
              <span className="ha-modal__title">Traspasar desde «{transferFromLocation?.name}»</span>
              <button className="ha-iconbtn" onClick={closeModal} aria-label="Cerrar">✕</button>
            </div>
            <div className="ha-modal__body">
              <p style={{ color: "var(--ha-text-3)", marginBottom: 16, fontSize: 14 }}>
                Se mueven todas las cantidades distintas de cero al destino. El total por producto no cambia; queda registro en movimientos.
              </p>
              <div className="ha-field">
                <label className="ha-label">Ubicación destino</label>
                <select
                  className={`ha-input${fTransferErr ? " ha-input--error" : ""}`}
                  value={fTransferTo}
                  onChange={(e) => { setFTransferTo(e.target.value); if (fTransferErr) setFTransferErr(false); }}
                >
                  <option value="">Elegí el destino</option>
                  {locations
                    .filter((l) => l.id !== transferFromLocation?.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " (predeterminada)" : ""}</option>
                    ))}
                </select>
                {fTransferErr && <span className="ha-error">Elegí el destino</span>}
              </div>
            </div>
            <div className="ha-modal__foot">
              <button className="ha-btn ha-btn--secondary" onClick={closeModal}>Cancelar</button>
              <button className="ha-btn ha-btn--primary" onClick={() => void doTransfer()} disabled={submitting}>
                {submitting ? "Traspasando…" : "Traspasar todo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {confirmDelete && (
        <div className="ha-dialog-back" onClick={() => setConfirmDelete(null)}>
          <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ha-dialog__head">
              <h3 className="ha-dialog__title">¿Eliminar esta ubicación?</h3>
              <p className="ha-dialog__sub">Solo se puede si no tiene stock. Los movimientos viejos quedarán sin ubicación.</p>
            </div>
            <div className="ha-dialog__foot">
              <button className="ha-btn ha-btn--secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="ha-btn ha-btn--destructive" onClick={() => void doDelete()}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      <LocationStockModal
        open={viewModalOpen}
        locationName={viewingLocation?.name ?? null}
        loading={viewLoading}
        balances={viewBalances}
        onClose={() => { setViewModalOpen(false); setViewingLocation(null); setViewBalances([]); }}
      />
    </div>
  );
}
