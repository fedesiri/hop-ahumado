"use client";

import { PriceListEditor } from "@/components/price-list/price-list-editor";
import { apiClient } from "@/lib/api-client";
import { useLineContext } from "@/lib/line-context";
import { PRICE_TYPES, PRICE_TYPE_LABELS, type PriceType } from "@/lib/order-calculator/price-types";
import { autoDetectSlots } from "@/lib/price-list-autodetect";
import { generatePriceListPdf, inferListFromPrices, loadImage } from "@/lib/price-list-pdf";
import { toast } from "@/lib/toast";
import type { PriceListTemplate, Product } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  initialListType?: PriceType | "";
  onClose: () => void;
}

interface Result {
  pdfUrl: string;
  previewUrl: string;
  file: File;
  missing: number;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function PriceListPdfModal({ initialListType, onClose }: Props) {
  const { selectedLineId } = useLineContext();
  const [templates, setTemplates] = useState<PriceListTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [listType, setListType] = useState<PriceType>(initialListType || "mayorista");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [note, setNote] = useState<{
    found: number;
    unmatched: string[];
    list: PriceType | null;
    reason: "alumo" | "titulo" | "precios" | null;
  } | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<PriceListTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!selectedLineId) return [];
    setLoading(true);
    try {
      const list = await apiClient.getPriceListTemplates(selectedLineId);
      setTemplates(list);
      setTemplateId((cur) => (cur && list.some((t) => t.id === cur) ? cur : (list[0]?.id ?? "")));
      return list;
    } catch {
      toast.error("Error al cargar las imágenes");
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedLineId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    return () => {
      if (result) {
        URL.revokeObjectURL(result.pdfUrl);
        URL.revokeObjectURL(result.previewUrl);
      }
    };
  }, [result]);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const loadAllProducts = async (): Promise<Product[]> => {
    if (products.length || !selectedLineId) return products;
    const all: Product[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await apiClient.getProducts(page, 100, false, undefined, undefined, selectedLineId);
      all.push(...res.data);
      totalPages = res.meta.totalPages;
      page += 1;
    } while (page <= totalPages);
    setProducts(all);
    return all;
  };

  const generate = async (target: PriceListTemplate | undefined, listOverride?: PriceType) => {
    if (!target) return;
    // si la imagen tiene lista fija (ej. las de Alumo son siempre mayorista), se usa esa
    const list: PriceType = listOverride ?? target.priceList ?? listType;
    if (target.slots.length === 0) {
      toast.error("Esta imagen todavía no tiene precios marcados. Tocá “Ajustar precios marcados”.");
      return;
    }
    setBusy("Generando el PDF…");
    setResult(null);
    try {
      const { pdf, jpeg, missing } = await generatePriceListPdf(target, list);
      const file = new File([pdf], `lista-${list}-${slugify(target.name) || "precios"}.pdf`, {
        type: "application/pdf",
      });
      setResult({ pdfUrl: URL.createObjectURL(pdf), previewUrl: URL.createObjectURL(jpeg), file, missing });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setBusy(null);
    }
  };

  /** Subir imagen: se crea, se leen los precios, se emparejan con productos y se genera el PDF, todo seguido. */
  const handleFile = async (file: File | undefined) => {
    if (!file || !selectedLineId) return;
    const name = file.name.replace(/\.[^.]+$/, "") || "Lista de precios";
    setResult(null);
    setNote(null);
    try {
      setBusy("Subiendo la imagen…");
      const img = await loadImage(file);
      const created = await apiClient.createPriceListTemplate({
        file,
        name,
        businessLineId: selectedLineId,
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
      });

      setBusy("Preparando lector de texto…");
      const prods = await loadAllProducts();
      const detected = await autoDetectSlots(file, img, prods, (pct, label) =>
        setBusy(pct > 0 ? `${label} ${pct}%` : `${label}…`),
      );

      await loadTemplates();
      setTemplateId(created.id);

      if (detected.slots.length === 0) {
        toast.error("No pude detectar los precios solos. Marcalos a mano.");
        setBusy(null);
        setEditing(created);
        return;
      }
      // Lista de la imagen: por su texto (Alumo, MAYORISTA, MINORISTA) o, si no se lee, comparando sus precios con la base.
      setBusy("Detectando la lista de precios…");
      let detectedList: PriceType | null = detected.listHint?.list ?? null;
      if (!detectedList) {
        try {
          detectedList = await inferListFromPrices(detected.oldPrices, selectedLineId);
        } catch {
          detectedList = null;
        }
      }

      setBusy("Guardando…");
      const saved = await apiClient.updatePriceListTemplate(created.id, {
        slots: detected.slots,
        priceList: detectedList,
      });
      setTemplates((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      setNote({
        found: detected.slots.length,
        unmatched: detected.unmatched,
        list: detectedList,
        reason: detected.listHint?.reason ?? (detectedList ? "precios" : null),
      });
      await generate(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo procesar la imagen");
      setBusy(null);
    }
  };

  const openEditor = async (t: PriceListTemplate) => {
    try {
      await loadAllProducts();
      setEditing(t);
    } catch {
      toast.error("No se pudieron cargar los productos");
    }
  };

  const handleDelete = async (t: PriceListTemplate) => {
    if (!window.confirm(`¿Eliminar "${t.name}"? Se borra la imagen y los precios marcados.`)) return;
    try {
      await apiClient.deletePriceListTemplate(t.id);
      toast.success("Imagen eliminada");
      setResult(null);
      await loadTemplates();
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const changeFixedList = async (t: PriceListTemplate, value: string) => {
    try {
      const saved = await apiClient.updatePriceListTemplate(t.id, { priceList: (value || null) as PriceType | null });
      setTemplates((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setResult(null);
    } catch {
      toast.error("No se pudo cambiar la lista");
    }
  };

  const share = async () => {
    if (!result) return;
    try {
      await navigator.share({ files: [result.file], title: result.file.name });
    } catch {
      // el usuario canceló
    }
  };

  const template = templates.find((t) => t.id === templateId);
  const effectiveList: PriceType = template?.priceList ?? listType;
  const listLocked = !!template?.priceList;
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    !!result &&
    navigator.canShare({ files: [result.file] });

  if (editing) {
    return (
      <PriceListEditor
        template={editing}
        products={products}
        onClose={() => setEditing(null)}
        onSaved={(t) => {
          setEditing(null);
          setTemplates((prev) => prev.map((p) => (p.id === t.id ? t : p)));
          setTemplateId(t.id);
          void generate(t);
        }}
      />
    );
  }

  const stepTitle = (n: number, text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          background: "var(--ha-amber)",
          color: "#0f1117",
          display: "inline-grid",
          placeItems: "center",
          fontSize: 12,
        }}
      >
        {n}
      </span>
      {text}
    </div>
  );

  return (
    <div className="ha-modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="ha-modal__head">
          <span className="ha-modal__title">Generar PDF de precios</span>
          <button className="ha-iconbtn" onClick={onClose} aria-label="Cerrar" disabled={!!busy}>
            ✕
          </button>
        </div>

        <div className="ha-modal__body">
          {/* Paso 1: lista */}
          <div style={{ marginBottom: 20 }}>
            {stepTitle(1, "¿Qué lista de precios?")}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRICE_TYPES.map((t) => (
                <button
                  key={t}
                  className={`ha-btn ${effectiveList === t ? "ha-btn--primary" : "ha-btn--secondary"}`}
                  onClick={() => setListType(t)}
                  disabled={!!busy || listLocked}
                >
                  {PRICE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {listLocked && (
              <div style={{ fontSize: 12, color: "var(--ha-text-2)", marginTop: 6 }}>
                Esta imagen usa siempre la lista {PRICE_TYPE_LABELS[effectiveList].toLowerCase()}. Podés cambiarlo abajo,
                en “Lista de esta imagen”.
              </div>
            )}
          </div>

          {/* Paso 2: imagen */}
          <div style={{ marginBottom: 20 }}>
            {stepTitle(2, "¿Sobre qué imagen?")}
            {loading ? (
              <div style={{ fontSize: 13 }}>Cargando…</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {templates.map((t) => {
                  const active = t.id === templateId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => !busy && setTemplateId(t.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: `2px solid ${active ? "var(--ha-amber)" : "var(--ha-border-2)"}`,
                        background: active ? "var(--ha-amber-soft)" : "transparent",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: "var(--ha-text-2)", whiteSpace: "nowrap" }}>
                        {t.priceList ? `${PRICE_TYPE_LABELS[t.priceList]} · ` : ""}
                        {t.slots.length} precios
                      </span>
                    </div>
                  );
                })}
                <button
                  className="ha-btn ha-btn--secondary"
                  style={{ height: 44, borderStyle: "dashed" }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!busy}
                >
                  ＋ Subir imagen nueva
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {templates.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--ha-text-2)" }}>
                    Subí la imagen de tu lista: la app lee sola los precios y los empareja con tus productos.
                  </div>
                )}
              </div>
            )}
            {template && !busy && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  Lista de esta imagen
                  <select
                    className="ha-input"
                    style={{ width: "auto", height: 36 }}
                    value={template.priceList ?? ""}
                    onChange={(e) => void changeFixedList(template, e.target.value)}
                  >
                    <option value="">La elijo cada vez</option>
                    {PRICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        Siempre {PRICE_TYPE_LABELS[t].toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="ha-btn ha-btn--secondary" onClick={() => void openEditor(template)}>
                  Ajustar precios marcados
                </button>
                <button className="ha-btn ha-btn--secondary" onClick={() => void handleDelete(template)}>
                  Eliminar
                </button>
              </div>
            )}
          </div>

          {/* Paso 3: generar */}
          <div style={{ marginBottom: 8 }}>
            {stepTitle(3, "Generar")}
            <button
              className="ha-btn ha-btn--primary"
              style={{ width: "100%", height: 48, fontSize: 15 }}
              onClick={() => void generate(template)}
              disabled={!template || !!busy}
            >
              {busy ?? `Generar PDF de lista ${PRICE_TYPE_LABELS[effectiveList].toLowerCase()}`}
            </button>
          </div>

          {note && (
            <div style={{ fontSize: 13, color: "var(--ha-text-2)", marginTop: 12 }}>
              <b style={{ color: "var(--ha-text)" }}>{note.found} precios detectados.</b>
              {note.list && (
                <>
                  {" "}
                  Lista: <b style={{ color: "var(--ha-text)" }}>{PRICE_TYPE_LABELS[note.list]}</b>
                  {note.reason === "alumo" && " (la imagen menciona a Alumo)"}
                  {note.reason === "titulo" && " (según el título de la imagen)"}
                  {note.reason === "precios" && " (según sus precios)"}.
                </>
              )}
              {!note.list && " No pude saber a qué lista corresponde: elegila arriba."}
              {note.unmatched.length > 0 && <> No encontré producto para: {note.unmatched.join(", ")}.</>} Revisá abajo que
              quedó bien; si algo no coincide, tocá “Ajustar precios marcados”.
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div ref={resultRef} style={{ marginTop: 20, display: "grid", gap: 10 }}>
              <strong>Listo. Revisá que los precios estén bien:</strong>
              {result.missing > 0 && (
                <span style={{ fontSize: 13, color: "var(--ha-amber)" }}>
                  {result.missing} producto(s) no tienen precio en esta lista y quedaron con “—”.
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.previewUrl}
                alt="Vista previa de la lista"
                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ha-border-2)" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  className="ha-btn ha-btn--primary"
                  style={{ flex: 1, height: 48 }}
                  href={result.pdfUrl}
                  download={result.file.name}
                >
                  ⬇ Descargar PDF
                </a>
                {canShare && (
                  <button className="ha-btn ha-btn--secondary" style={{ height: 48 }} onClick={() => void share()}>
                    Compartir
                  </button>
                )}
                <a
                  className="ha-btn ha-btn--secondary"
                  style={{ height: 48 }}
                  href={result.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
