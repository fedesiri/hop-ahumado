"use client";

import { generateQuoteDocument, quoteFileBase } from "@/lib/quote-document";
import type { Quote } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface Result {
  pdfUrl: string;
  imageUrl: string;
  pdfFile: File;
  imageFile: File;
}

/** Vista previa del presupuesto para el cliente, con descarga/envío en PDF e imagen. */
export function QuoteDocumentModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let urls: string[] = [];
    setResult(null);
    setError(null);
    generateQuoteDocument(quote)
      .then(({ pdf, jpeg }) => {
        if (cancelled) return;
        const base = quoteFileBase(quote);
        const pdfFile = new File([pdf], `${base}.pdf`, { type: "application/pdf" });
        const imageFile = new File([jpeg], `${base}.jpg`, { type: "image/jpeg" });
        const pdfUrl = URL.createObjectURL(pdfFile);
        const imageUrl = URL.createObjectURL(imageFile);
        urls = [pdfUrl, imageUrl];
        setResult({ pdfUrl, imageUrl, pdfFile, imageFile });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo generar el presupuesto");
      });
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [quote]);

  const canShare = (f?: File) =>
    !!f && typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] });

  const share = async (f: File) => {
    try {
      await navigator.share({ files: [f], title: f.name });
    } catch {
      // el usuario canceló
    }
  };

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="ha-modal__head">
          <span className="ha-modal__title">Presupuesto para el cliente</span>
          <button className="ha-iconbtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="ha-modal__body">
          {!result && !error && <Spinner />}
          {error && <p style={{ color: "var(--ha-red)" }}>{error}</p>}
          {result && (
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Listo. Revisá que esté todo bien antes de mandarlo:</strong>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt="Vista previa del presupuesto"
                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ha-border-2)" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="ha-btn ha-btn--primary" style={{ flex: 1, height: 48 }} href={result.pdfUrl} download={result.pdfFile.name}>
                  ⬇ Descargar PDF
                </a>
                {canShare(result.pdfFile) && (
                  <button className="ha-btn ha-btn--secondary" style={{ height: 48 }} onClick={() => void share(result.pdfFile)}>
                    Compartir PDF
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="ha-btn ha-btn--secondary" style={{ flex: 1, height: 48 }} href={result.imageUrl} download={result.imageFile.name}>
                  ⬇ Descargar imagen
                </a>
                {canShare(result.imageFile) && (
                  <button className="ha-btn ha-btn--secondary" style={{ height: 48 }} onClick={() => void share(result.imageFile)}>
                    Enviar imagen (WhatsApp)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
