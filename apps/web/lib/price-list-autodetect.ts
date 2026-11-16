import {
  detectRows,
  matchRows,
  type DetectedRow,
  type MatchableProduct,
  type OcrWord,
} from "@/lib/price-list-detect";
import { contrastTextColor, sampleTextColor } from "@/lib/price-list-render";
import type { PriceListSlot } from "@/lib/types";

export interface AutoDetectResult {
  slots: PriceListSlot[];
  /** Filas con precio que no se pudieron emparejar con un producto (ej. teléfonos, "compra mínima"). */
  unmatched: string[];
}

/** Lee la imagen con OCR (en el navegador, sin enviarla a ningún servicio) y devuelve las palabras con su posición. */
export async function ocrWords(image: Blob, onProgress?: (pct: number, label: string) => void): Promise<OcrWord[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100), "Leyendo la imagen");
      else onProgress?.(0, "Preparando lector de texto");
    },
  });
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          for (const w of line.words) {
            words.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
          }
        }
      }
    }
    return words;
  } finally {
    await worker.terminate();
  }
}

export function rowsToSlots(
  rows: { row: DetectedRow; productId: string }[],
  image: HTMLImageElement,
): PriceListSlot[] {
  const W = image.naturalWidth;
  const H = image.naturalHeight;
  return rows.map(({ row, productId }) => {
    const slot = {
      x: row.price.x0 / W,
      y: row.price.y0 / H,
      w: (row.price.x1 - row.price.x0) / W,
      h: (row.price.y1 - row.price.y0) / H,
    };
    const textColor = sampleTextColor(image, slot);
    return {
      id: crypto.randomUUID(),
      productId,
      ...slot,
      coverColor: "#000000",
      coverMode: "blend" as const,
      // si el color leído es casi igual al fondo, usar blanco/negro por contraste
      textColor: textColor || contrastTextColor("#000000"),
      align: "right" as const,
      fontScale: 1,
    };
  });
}

export async function autoDetectSlots<P extends MatchableProduct>(
  imageBlob: Blob,
  image: HTMLImageElement,
  products: P[],
  onProgress?: (pct: number, label: string) => void,
): Promise<AutoDetectResult> {
  const words = await ocrWords(imageBlob, onProgress);
  const rows = detectRows(words);
  const { matched, unmatched } = matchRows(rows, products);
  const slots = rowsToSlots(
    matched.map((m) => ({ row: m.row, productId: m.product.id })),
    image,
  );
  return { slots, unmatched: unmatched.map((r) => r.name) };
}
