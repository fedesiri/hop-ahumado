"use client";

import { LocationStockModal } from "@/components/stock/location-stock-modal";
import { apiClient } from "@/lib/api-client";
import { useLineContext } from "@/lib/line-context";
import type { StockBalanceRow, StockLocation } from "@/lib/types";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Spinner } from "@/components/spinner";
import { ArrowLeftRight, Eye, Pencil, Plus, Trash2 } from "lucide-react";
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

  const stockCountLabel = (locId: string) => {
    const count = stockCounts[locId] ?? null;
    if (count === null) return null;
    return `${count} producto${count !== 1 ? "s" : ""}`;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 className="pc-pagetitle" style={{ margin: 0 }}>Stock · Ubicaciones</h1>
        <button className="pc-btn pc-btn--primary ub-newbtn" onClick={openCreate}>
          + Nueva ubicación
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : locations.length === 0 ? (
        <EmptyState title="No hay ubicaciones de stock" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="pc-card">
            <div className="pc-tablewrap" style={{ overflowX: "auto" }}>
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
                          <span className={`ub-pill ${loc.isDefault ? "ub-pill--yes" : "ub-pill--no"}`}>
                            {loc.isDefault ? "Sí" : "No"}
                          </span>
                        </td>
                        <td className="pc-vig">{new Date(loc.createdAt).toLocaleDateString("es-AR")}</td>
                        <td>
                          {count === null
                            ? <span className="pc-vig">—</span>
                            : <span className="ub-prod">{count} producto{count !== 1 ? "s" : ""}</span>}
                        </td>
                        <td>
                          <div className="ub-acts">
                            <button className="ub-actbtn" title="Ver stock" onClick={() => void openView(loc)}>
                              <Eye size={14} />
                            </button>
                            <button className="ub-actbtn" title="Editar" onClick={() => openEdit(loc)}>
                              <Pencil size={14} />
                            </button>
                            <button
                              className="ub-actbtn"
                              title="Traspasar todo el stock"
                              disabled={locations.length < 2}
                              onClick={() => openTransfer(loc)}
                            >
                              <ArrowLeftRight size={14} />
                            </button>
                            <button
                              className={`ub-actbtn${canDelete ? " ub-actbtn--del" : " ub-actbtn--off"}`}
                              title={canDelete ? "Eliminar" : "No se puede eliminar: tiene stock"}
                              disabled={!canDelete}
                              onClick={() => canDelete && setConfirmDelete(loc)}
                            >
                              <Trash2 size={14} />
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

          {/* Mobile cards */}
          <div className="ub-cardlist">
            {locations.map((loc) => {
              const count = stockCounts[loc.id] ?? null;
              const canDelete = count === 0;
              const label = stockCountLabel(loc.id);
              return (
                <div key={loc.id} className="ub-loccard">
                  <div className="ub-loccard__top">
                    <span className="ub-loccard__name">{loc.name}</span>
                    <span className={`ub-pill ${loc.isDefault ? "ub-pill--yes" : "ub-pill--no"}`}>
                      {loc.isDefault ? "Sí" : "No"}
                    </span>
                  </div>
                  <div className="ub-loccard__mid">
                    {label !== null
                      ? <span className="ub-prod">{label}</span>
                      : <span className="ub-loccard__date">—</span>}
                    <span className="ub-loccard__date">
                      {new Date(loc.createdAt).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                  <div className="ub-loccard__acts">
                    <button className="ub-actbtn" onClick={() => void openView(loc)} aria-label="Ver stock">
                      <Eye size={16} />
                    </button>
                    <button className="ub-actbtn" onClick={() => openEdit(loc)} aria-label="Editar">
                      <Pencil size={16} />
                    </button>
                    <button
                      className="ub-actbtn"
                      disabled={locations.length < 2}
                      onClick={() => openTransfer(loc)}
                      aria-label="Traspasar"
                    >
                      <ArrowLeftRight size={16} />
                    </button>
                    <button
                      className={`ub-actbtn${canDelete ? " ub-actbtn--del" : " ub-actbtn--off"}`}
                      disabled={!canDelete}
                      onClick={() => canDelete && setConfirmDelete(loc)}
                      aria-label="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Mobile FAB */}
      <button className="ha-fab" onClick={openCreate} aria-label="Nueva ubicación">
        <Plus size={24} />
      </button>

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
        <ConfirmDialog
          title="¿Eliminar esta ubicación?"
          description="Solo se puede si no tiene stock. Los movimientos viejos quedarán sin ubicación."
          confirmLabel="Sí, eliminar"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void doDelete()}
        />
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
