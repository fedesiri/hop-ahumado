"use client";

import { apiClient } from "@/lib/api-client";
import { PRICE_TYPES, PRICE_TYPE_LABELS, type PriceType } from "@/lib/order-calculator/price-types";
import {
  contrastTextColor,
  fetchPriceMap,
  loadImage,
  renderPriceListJpeg,
  sampleCoverColor,
} from "@/lib/price-list-pdf";
import { toast } from "@/lib/toast";
import type { PriceListSlot, PriceListTemplate, Product } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DragState =
  | { kind: "draw"; id: string; startX: number; startY: number }
  | { kind: "move"; id: string; offX: number; offY: number }
  | { kind: "resize"; id: string };

const MIN_W = 0.015;
const MIN_H = 0.008;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Slot en edición: productId puede estar vacío hasta que se elija. */
type EditSlot = Omit<PriceListSlot, "productId"> & { productId: string };

interface Props {
  template: PriceListTemplate;
  products: Product[];
  onClose: () => void;
  onSaved: (t: PriceListTemplate) => void;
}

export function PriceListEditor({ template, products, onClose, onSaved }: Props) {
  const [slots, setSlots] = useState<EditSlot[]>(template.slots as EditSlot[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markMode, setMarkMode] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [previewList, setPreviewList] = useState<PriceType>("mayorista");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    (async () => {
      try {
        const blob = await apiClient.getPriceListTemplateImage(template.id);
        const img = await loadImage(blob);
        if (revoked) return;
        imageRef.current = img;
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      } catch {
        toast.error("No se pudo cargar la imagen");
      }
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [template.id]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [products],
  );

  const selected = slots.find((s) => s.id === selectedId) ?? null;

  const patchSlot = useCallback((id: string, patch: Partial<EditSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
  }, []);

  const toFraction = (e: React.PointerEvent) => {
    const rect = areaRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height), rect };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!markMode || !areaRef.current) return;
    e.preventDefault();
    const { x, y, rect } = toFraction(e);
    areaRef.current.setPointerCapture(e.pointerId);

    // 1) manija de redimensionar de la zona seleccionada (área táctil de ~22px)
    if (selected) {
      const hx = (selected.x + selected.w) * rect.width;
      const hy = (selected.y + selected.h) * rect.height;
      if (Math.hypot(e.clientX - rect.left - hx, e.clientY - rect.top - hy) < 22) {
        dragRef.current = { kind: "resize", id: selected.id };
        return;
      }
    }
    // 2) tocar una zona existente: seleccionarla y moverla
    for (let i = slots.length - 1; i >= 0; i--) {
      const s = slots[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
        setSelectedId(s.id);
        dragRef.current = { kind: "move", id: s.id, offX: x - s.x, offY: y - s.y };
        return;
      }
    }
    // 3) arrastrar sobre vacío: dibujar una zona nueva
    const id = crypto.randomUUID();
    const base: EditSlot = {
      id,
      productId: "",
      x,
      y,
      w: 0,
      h: 0,
      coverColor: "#ffffff",
      textColor: "#111111",
      align: "center",
      fontScale: 1,
    };
    setSlots((prev) => [...prev, base]);
    setSelectedId(id);
    dragRef.current = { kind: "draw", id, startX: x, startY: y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !areaRef.current) return;
    const { x, y } = toFraction(e);
    if (drag.kind === "draw") {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === drag.id
            ? {
                ...s,
                x: Math.min(drag.startX, x),
                y: Math.min(drag.startY, y),
                w: Math.abs(x - drag.startX),
                h: Math.abs(y - drag.startY),
              }
            : s,
        ),
      );
    } else if (drag.kind === "move") {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === drag.id
            ? { ...s, x: Math.min(1 - s.w, Math.max(0, x - drag.offX)), y: Math.min(1 - s.h, Math.max(0, y - drag.offY)) }
            : s,
        ),
      );
      setDirty(true);
    } else {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === drag.id ? { ...s, w: Math.max(MIN_W, x - s.x), h: Math.max(MIN_H, y - s.y) } : s,
        ),
      );
      setDirty(true);
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === "draw") {
      const s = slots.find((p) => p.id === drag.id);
      if (!s || s.w < MIN_W || s.h < MIN_H) {
        // toque sin arrastre: descartar la zona vacía
        setSlots((prev) => prev.filter((p) => p.id !== drag.id));
        setSelectedId(null);
        return;
      }
      const img = imageRef.current;
      const cover = img ? sampleCoverColor(img, s) : "#ffffff";
      setDirty(true);
      setSlots((prev) =>
        prev.map((p) => (p.id === s.id ? { ...p, coverColor: cover, textColor: contrastTextColor(cover) } : p)),
      );
    }
  };

  const detectColor = () => {
    if (!selected || !imageRef.current) return;
    const cover = sampleCoverColor(imageRef.current, selected);
    patchSlot(selected.id, { coverColor: cover, textColor: contrastTextColor(cover) });
  };

  const removeSelected = () => {
    if (!selected) return;
    setSlots((prev) => prev.filter((s) => s.id !== selected.id));
    setSelectedId(null);
    setDirty(true);
  };

  const save = async () => {
    const incomplete = slots.filter((s) => !s.productId).length;
    if (incomplete > 0) {
      toast.error(`Hay ${incomplete} zona(s) sin producto. Elegí uno o eliminalas.`);
      return;
    }
    setSaving(true);
    try {
      const updated = await apiClient.updatePriceListTemplate(template.id, { slots: slots as PriceListSlot[] });
      toast.success("Plantilla guardada");
      setDirty(false);
      onSaved(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Salir igual?")) return;
    onClose();
  };

  const preview = async () => {
    if (!imageRef.current) return;
    const valid = slots.filter((s) => s.productId);
    setPreviewing(true);
    try {
      const prices = await fetchPriceMap(previewList, template.businessLineId);
      const { blob } = await renderPriceListJpeg(imageRef.current, valid as PriceListSlot[], prices);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la vista previa");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="ha-modal-backdrop" style={{ padding: 8 }}>
      <div className="ha-modal" style={{ maxWidth: 980, maxHeight: "96vh", height: "96vh" }}>
        <div className="ha-modal__head">
          <span className="ha-modal__title">{template.name}</span>
          <button className="ha-iconbtn" onClick={close} aria-label="Cerrar">✕</button>
        </div>

        <div className="ha-modal__body" style={{ padding: 12 }}>
          {previewUrl ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Vista previa" style={{ width: "100%", borderRadius: 8 }} />
              <button
                className="ha-btn ha-btn--secondary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setPreviewUrl(null);
                }}
              >
                Volver a editar
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--ha-text-2)", margin: "0 0 10px" }}>
                Arrastrá sobre cada precio de la imagen para marcarlo. Tocá una zona para moverla; la manija de la
                esquina inferior derecha cambia su tamaño. En el celular, apagá “Marcar” para desplazarte por la imagen.
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <button
                  className={`ha-btn ${markMode ? "ha-btn--primary" : "ha-btn--secondary"}`}
                  onClick={() => setMarkMode((m) => !m)}
                >
                  {markMode ? "✏️ Marcar: activo" : "✋ Desplazar"}
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.25}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </label>
                <span style={{ fontSize: 13, color: "var(--ha-text-2)" }}>{slots.length} zonas</span>
              </div>

              <div
                style={{
                  overflow: "auto",
                  maxHeight: "55vh",
                  border: "1px solid var(--ha-border-2)",
                  borderRadius: 8,
                  background: "var(--ha-bg-raised)",
                }}
              >
                <div
                  ref={areaRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "relative",
                    width: `${zoom * 100}%`,
                    touchAction: markMode ? "none" : "auto",
                    userSelect: "none",
                    cursor: markMode ? "crosshair" : "default",
                  }}
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={template.name}
                      draggable={false}
                      style={{ width: "100%", display: "block", pointerEvents: "none" }}
                    />
                  ) : (
                    <div style={{ padding: 40, textAlign: "center" }}>Cargando imagen…</div>
                  )}
                  {slots.map((s) => {
                    const isSel = s.id === selectedId;
                    return (
                      <div
                        key={s.id}
                        style={{
                          position: "absolute",
                          left: `${s.x * 100}%`,
                          top: `${s.y * 100}%`,
                          width: `${s.w * 100}%`,
                          height: `${s.h * 100}%`,
                          border: `2px solid ${s.productId ? (isSel ? "#f5a623" : "#22c55e") : "#ef4444"}`,
                          background: isSel ? "rgba(245,166,35,.18)" : "rgba(34,197,94,.12)",
                          boxSizing: "border-box",
                          pointerEvents: "none",
                        }}
                      >
                        {isSel && (
                          <span
                            style={{
                              position: "absolute",
                              right: -10,
                              bottom: -10,
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              background: "#f5a623",
                              border: "2px solid #fff",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected ? (
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <div className="ha-field">
                    <label className="ha-label">Producto de esta zona</label>
                    <select
                      className="ha-input"
                      value={selected.productId}
                      onChange={(e) => patchSlot(selected.id, { productId: e.target.value })}
                    >
                      <option value="">Elegí un producto…</option>
                      {sortedProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div className="ha-field">
                      <label className="ha-label">Color de fondo</label>
                      <input
                        type="color"
                        value={selected.coverColor}
                        onChange={(e) => patchSlot(selected.id, { coverColor: e.target.value })}
                        style={{ width: 56, height: 40 }}
                      />
                    </div>
                    <div className="ha-field">
                      <label className="ha-label">Color del texto</label>
                      <input
                        type="color"
                        value={selected.textColor}
                        onChange={(e) => patchSlot(selected.id, { textColor: e.target.value })}
                        style={{ width: 56, height: 40 }}
                      />
                    </div>
                    <button className="ha-btn ha-btn--secondary" onClick={detectColor}>
                      Detectar fondo
                    </button>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          className={`ha-btn ${selected.align === a ? "ha-btn--primary" : "ha-btn--secondary"}`}
                          onClick={() => patchSlot(selected.id, { align: a })}
                        >
                          {a === "left" ? "Izq" : a === "center" ? "Centro" : "Der"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    Tamaño de letra
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={selected.fontScale}
                      onChange={(e) => patchSlot(selected.id, { fontScale: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                  </label>

                  <div>
                    <button className="ha-btn ha-btn--secondary" onClick={removeSelected}>
                      Eliminar zona
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--ha-text-3)", marginTop: 12 }}>
                  Seleccioná o dibujá una zona para configurarla.
                </p>
              )}
            </>
          )}
        </div>

        {!previewUrl && (
          <div className="ha-modal__foot" style={{ flexWrap: "wrap" }}>
            <select
              className="ha-input"
              style={{ width: "auto" }}
              value={previewList}
              onChange={(e) => setPreviewList(e.target.value as PriceType)}
            >
              {PRICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PRICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <button className="ha-btn ha-btn--secondary" onClick={() => void preview()} disabled={previewing}>
              {previewing ? "Generando…" : "Vista previa"}
            </button>
            <button className="ha-btn ha-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
