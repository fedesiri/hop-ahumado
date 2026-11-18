"use client";

import { ocrReceiptText } from "@/lib/receipt-ocr";
import { parseReceiptText, type ParsedReceipt } from "@/lib/receipt-parse";
import { toast } from "@/lib/toast";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Botón "Escanear ticket": abre la cámara (o la galería), lee la foto con OCR gratuito en el navegador
 * y devuelve la foto junto con los datos detectados para que el formulario se precargue.
 * Nada se guarda hasta que la persona revisa y confirma el formulario.
 */
export function ScanReceiptButton({
  onScanned,
  disabled,
}: {
  onScanned: (file: File, parsed: ParsedReceipt) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ pct: number; label: string } | null>(null);

  const handleFile = async (file: File) => {
    setStatus({ pct: 0, label: "Preparando lector de texto" });
    try {
      const text = await ocrReceiptText(file, (pct, label) => setStatus({ pct, label }));
      const parsed = parseReceiptText(text);
      const found = [parsed.total, parsed.date, parsed.supplier].filter(Boolean).length;
      onScanned(file, parsed);
      if (found === 0) toast.error("No se pudo leer el ticket. Probá con una foto más derecha y con buena luz, o cargalo a mano.");
      else toast.success("Ticket leído. Revisá los datos antes de guardar.");
    } catch {
      toast.error("No se pudo leer el ticket. Cargalo a mano.");
    } finally {
      setStatus(null);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ha-btn ha-btn--secondary"
        disabled={disabled || !!status}
        onClick={() => inputRef.current?.click()}
      >
        <Camera size={15} />{" "}
        {status ? `${status.label}${status.pct ? ` ${status.pct}%` : "…"}` : "Escanear ticket"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </>
  );
}
