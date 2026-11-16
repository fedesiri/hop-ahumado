"use client";

import { PriceListEditor } from "@/components/price-list/price-list-editor";
import { apiClient } from "@/lib/api-client";
import { useLineContext } from "@/lib/line-context";
import { PRICE_TYPES, PRICE_TYPE_LABELS, type PriceType } from "@/lib/order-calculator/price-types";
import { generatePriceListPdf, loadImage } from "@/lib/price-list-pdf";
import { toast } from "@/lib/toast";
import type { PriceListTemplate, Product } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  initialListType?: PriceType | "";
  onClose: () => void;
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
  const [listType, setListType] = useState<PriceType>(
    initialListType === "minorista" ? "minorista" : initialListType || "mayorista",
  );
  const [generating, setGenerating] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const [result, setResult] = useState<{ url: string; file: File; missing: number } | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<PriceListTemplate | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState("");

  const loadTemplates = useCallback(async () => {
    if (!selectedLineId) return;
    setLoading(true);
    try {
      const list = await apiClient.getPriceListTemplates(selectedLineId);
      setTemplates(list);
      setTemplateId((cur) => (cur && list.some((t) => t.id === cur) ? cur : (list[0]?.id ?? "")));
    } catch {
      toast.error("Error al cargar las plantillas");
    } finally {
      setLoading(false);
    }
  }, [selectedLineId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  // Al terminar de generar, mostrar el recuadro con los botones de descarga.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [result]);

  const loadAllProducts = async () => {
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

  const openEditor = async (t: PriceListTemplate) => {
    try {
      await loadAllProducts();
      setEditing(t);
    } catch {
      toast.error("No se pudieron cargar los productos");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !selectedLineId) return;
    const name = newName.trim() || file.name.replace(/\.[^.]+$/, "");
    setUploading(true);
    try {
      const img = await loadImage(file);
      const created = await apiClient.createPriceListTemplate({
        file,
        name,
        businessLineId: selectedLineId,
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
      });
      setNewName("");
      await loadTemplates();
      setTemplateId(created.id);
      toast.success("Imagen subida. Detectando los precios…");
      await openEditor(created);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (t: PriceListTemplate) => {
    if (!window.confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    try {
      await apiClient.deletePriceListTemplate(t.id);
      toast.success("Plantilla eliminada");
      await loadTemplates();
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const template = templates.find((t) => t.id === templateId) ?? null;

  const generate = async () => {
    if (!template) return;
    if (template.slots.length === 0) {
      toast.error("Esta plantilla todavía no tiene precios marcados. Tocá “Editar”.");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const { pdf, missing } = await generatePriceListPdf(template, listType);
      const file = new File([pdf], `lista-${listType}-${slugify(template.name) || "precios"}.pdf`, {
        type: "application/pdf",
      });
      setResult({ url: URL.createObjectURL(pdf), file, missing });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setGenerating(false);
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
        }}
      />
    );
  }

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="ha-modal__head">
          <span className="ha-modal__title">Generar PDF de precios</span>
          <button className="ha-iconbtn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="ha-modal__body">
          <div className="ha-field" style={{ marginBottom: 16 }}>
            <label className="ha-label">Imagen</label>
            {loading ? (
              <div style={{ fontSize: 13 }}>Cargando…</div>
            ) : templates.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ha-text-2)" }}>
                Todavía no hay imágenes. Subí la primera abajo.
              </div>
            ) : (
              <select className="ha-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slots.length} precios)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="ha-field" style={{ marginBottom: 16 }}>
            <label className="ha-label">Lista de precios</label>
            <select className="ha-input" value={listType} onChange={(e) => setListType(e.target.value as PriceType)}>
              {PRICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PRICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {template && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <button className="ha-btn ha-btn--secondary" onClick={() => void openEditor(template)}>
                Editar precios marcados
              </button>
              <button className="ha-btn ha-btn--secondary" onClick={() => void handleDelete(template)}>
                Eliminar imagen
              </button>
            </div>
          )}

          {result && (
            <div
              ref={resultRef}
              style={{
                marginBottom: 16,
                padding: 12,
                border: "2px solid var(--ha-amber)",
                borderRadius: 8,
                display: "grid",
                gap: 8,
              }}
            >
              <strong>PDF listo</strong>
              {result.missing > 0 && (
                <span style={{ fontSize: 13, color: "var(--ha-amber)" }}>
                  {result.missing} producto(s) no tienen precio en esta lista y quedaron con “—”.
                </span>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="ha-btn ha-btn--primary" href={result.url} download={result.file.name}>
                  Descargar
                </a>
                <a className="ha-btn ha-btn--secondary" href={result.url} target="_blank" rel="noreferrer">
                  Abrir
                </a>
                {canShare && (
                  <button className="ha-btn ha-btn--secondary" onClick={() => void share()}>
                    Compartir
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid var(--ha-border)",
              paddingTop: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <label className="ha-label">Subir imagen nueva</label>
            <input
              className="ha-input"
              placeholder="Nombre (opcional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {uploading && <div style={{ fontSize: 13 }}>Subiendo…</div>}
          </div>

        </div>

        <div className="ha-modal__foot">
          <button className="ha-btn ha-btn--secondary" onClick={onClose}>
            Cerrar
          </button>
          <button className="ha-btn ha-btn--primary" onClick={() => void generate()} disabled={!template || generating}>
            {generating ? "Generando…" : "Generar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
