/**
 * Lee un ticket con OCR gratuito (Tesseract), directamente en el navegador:
 * la foto no se envía a ningún servicio externo. Antes de leerla la pasa a escala de grises
 * y con más contraste, que es lo que más mejora la lectura de papel térmico.
 */
async function prepare(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(2, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - min) / range - 0.1) * 255 * 1.15));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))) ?? file;
  } catch {
    return file;
  }
}

export async function ocrReceiptText(file: File, onProgress?: (pct: number, label: string) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100), "Leyendo el ticket");
      else onProgress?.(0, "Preparando lector de texto");
    },
  });
  try {
    const { data } = await worker.recognize(await prepare(file));
    return data.text;
  } finally {
    await worker.terminate();
  }
}
