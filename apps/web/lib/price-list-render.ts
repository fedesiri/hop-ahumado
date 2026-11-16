import { formatCurrency } from "@/lib/format-currency";
import type { PriceListSlot } from "@/lib/types";

/** Módulo sin llamadas a la API: dibuja los precios sobre la imagen y arma el PDF. */

/** Lado máximo del lienzo: evita quedarse sin memoria en celulares con imágenes enormes. */
const MAX_SIDE = 3000;

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), type, quality);
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Relleno que reconstruye el fondo: interpola los bordes de la zona (sirve con degradés y fondos oscuros). */
function blendCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  W: number,
  H: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  const x0 = clamp(Math.floor(rx), 0, W - 1);
  const y0 = clamp(Math.floor(ry), 0, H - 1);
  const w = clamp(Math.ceil(rw), 1, W - x0);
  const h = clamp(Math.ceil(rh), 1, H - y0);
  const m = 3; // franja de muestreo fuera de la zona
  const sx = Math.max(0, x0 - m);
  const sy = Math.max(0, y0 - m);
  const ex = Math.min(W, x0 + w + m);
  const ey = Math.min(H, y0 + h + m);
  const sw = ex - sx;
  const sh = ey - sy;
  const data = src.getImageData(sx, sy, sw, sh).data;
  const px = (x: number, y: number, c: number) => data[((y - sy) * sw + (x - sx)) * 4 + c];

  const avgCol = (xa: number, xb: number, y: number, c: number) => {
    let sum = 0;
    let n = 0;
    for (let x = xa; x < xb; x++) {
      if (x < sx || x >= ex) continue;
      sum += px(x, clamp(y, sy, ey - 1), c);
      n++;
    }
    return n ? sum / n : 0;
  };
  const avgRow = (ya: number, yb: number, x: number, c: number) => {
    let sum = 0;
    let n = 0;
    for (let y = ya; y < yb; y++) {
      if (y < sy || y >= ey) continue;
      sum += px(clamp(x, sx, ex - 1), y, c);
      n++;
    }
    return n ? sum / n : 0;
  };

  const out = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const y = y0 + j;
    const ty = h > 1 ? j / (h - 1) : 0;
    for (let i = 0; i < w; i++) {
      const x = x0 + i;
      const tx = w > 1 ? i / (w - 1) : 0;
      for (let c = 0; c < 3; c++) {
        const L = avgCol(x0 - m, x0, y, c);
        const R = avgCol(x0 + w, x0 + w + m, y, c);
        const T = avgRow(y0 - m, y0, x, c);
        const B = avgRow(y0 + h, y0 + h + m, x, c);
        const horiz = L + (R - L) * tx;
        const vert = T + (B - T) * ty;
        out.data[(j * w + i) * 4 + c] = Math.round((horiz + vert) / 2);
      }
      out.data[(j * w + i) * 4 + 3] = 255;
    }
  }
  ctx.putImageData(out, x0, y0);
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  slot: PriceListSlot,
  W: number,
  H: number,
  value: number | undefined,
) {
  const x = slot.x * W;
  const y = slot.y * H;
  const w = slot.w * W;
  const h = slot.h * H;

  // El OCR devuelve la caja ajustada al texto: se tapa un poco más para no dejar bordes del precio viejo.
  const padX = h * 0.3;
  const padY = h * 0.18;
  if (slot.coverMode === "blend") {
    blendCover(ctx, src, W, H, x - padX, y - padY, w + padX * 2, h + padY * 2);
  } else {
    ctx.fillStyle = slot.coverColor;
    ctx.fillRect(x - padX, y - padY, w + padX * 2, h + padY * 2);
  }

  const text = value === undefined ? "—" : formatCurrency(value);
  let size = h * 1.0 * slot.fontScale;
  const font = (s: number) => `700 ${s}px "Poppins", "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font(size);
  const maxW = w * 1.3;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = font(size);
  }
  ctx.fillStyle = slot.textColor;
  ctx.textBaseline = "middle";
  ctx.textAlign = slot.align;
  const tx = slot.align === "left" ? x : slot.align === "right" ? x + w : x + w / 2;
  ctx.fillText(text, tx, y + h / 2);
}

/** Dibuja la imagen con los precios nuevos encima y devuelve un JPEG. */
export async function renderPriceListJpeg(
  image: HTMLImageElement,
  slots: PriceListSlot[],
  prices: Map<string, number>,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const W = Math.round(image.naturalWidth * scale);
  const H = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Tu navegador no pudo preparar la imagen");
  ctx.drawImage(image, 0, 0, W, H);

  // Copia intacta: los rellenos leen de acá para no mezclarse con zonas ya pisadas.
  const pristine = document.createElement("canvas");
  pristine.width = W;
  pristine.height = H;
  const src = pristine.getContext("2d", { willReadFrequently: true });
  if (!src) throw new Error("Tu navegador no pudo preparar la imagen");
  src.drawImage(canvas, 0, 0);

  for (const slot of slots) drawSlot(ctx, src, slot, W, H, prices.get(slot.productId));
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  return { blob, width: W, height: H };
}

/** PDF de una sola página con la imagen a página completa (sin dependencias externas). */
export async function jpegToPdf(jpeg: Blob, imgW: number, imgH: number): Promise<Blob> {
  const data = new Uint8Array(await jpeg.arrayBuffer());
  const pageW = 595; // ancho A4 en puntos; el alto sigue la proporción de la imagen
  const pageH = Math.round((pageW * imgH) / imgW);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array) => {
    parts.push(chunk);
    length += chunk.length;
  };
  const text = (s: string) => push(enc.encode(s));
  const obj = (n: number, body: string) => {
    offsets[n] = length;
    text(`${n} 0 obj\n${body}\nendobj\n`);
  };

  text("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offsets[4] = length;
  text(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
  );
  push(data);
  text("\nendstream\nendobj\n");
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const xrefAt = length;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  text(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

function medianOf(a: number[]) {
  return [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function drawToCanvas(image: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const W = Math.max(1, Math.round(image.naturalWidth * scale));
  const H = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, W, H);
  return { ctx, W, H };
}

/** Mediana de los píxeles que rodean la zona: el color de fondo para tapar el precio. */
export function sampleCoverColor(image: HTMLImageElement, slot: Pick<PriceListSlot, "x" | "y" | "w" | "h">): string {
  const c = drawToCanvas(image, 1500);
  if (!c) return "#ffffff";
  const { ctx, W, H } = c;
  const x0 = Math.floor(slot.x * W);
  const y0 = Math.floor(slot.y * H);
  const x1 = Math.ceil((slot.x + slot.w) * W);
  const y1 = Math.ceil((slot.y + slot.h) * H);
  const pad = 3;
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1; x += 2) pts.push([x, y0 - pad], [x, y1 + pad]);
  for (let y = y0; y <= y1; y += 2) pts.push([x0 - pad, y], [x1 + pad, y]);
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d = ctx.getImageData(x, y, 1, 1).data;
    rs.push(d[0]);
    gs.push(d[1]);
    bs.push(d[2]);
  }
  if (!rs.length) return "#ffffff";
  return rgbToHex(medianOf(rs), medianOf(gs), medianOf(bs));
}

/** Color del texto original: promedio de los píxeles de la zona que más se alejan del fondo. */
export function sampleTextColor(image: HTMLImageElement, slot: Pick<PriceListSlot, "x" | "y" | "w" | "h">): string {
  const c = drawToCanvas(image, 1500);
  if (!c) return "#ffffff";
  const { ctx, W, H } = c;
  const bg = sampleCoverColor(image, slot);
  const br = parseInt(bg.slice(1, 3), 16);
  const bgc = parseInt(bg.slice(3, 5), 16);
  const bb = parseInt(bg.slice(5, 7), 16);
  const x0 = Math.max(0, Math.floor(slot.x * W));
  const y0 = Math.max(0, Math.floor(slot.y * H));
  const w = Math.max(1, Math.min(W - x0, Math.ceil(slot.w * W)));
  const h = Math.max(1, Math.min(H - y0, Math.ceil(slot.h * H)));
  const d = ctx.getImageData(x0, y0, w, h).data;
  const px: { dist: number; r: number; g: number; b: number }[] = [];
  for (let i = 0; i < d.length; i += 4) {
    px.push({
      dist: (d[i] - br) ** 2 + (d[i + 1] - bgc) ** 2 + (d[i + 2] - bb) ** 2,
      r: d[i],
      g: d[i + 1],
      b: d[i + 2],
    });
  }
  px.sort((a, b) => b.dist - a.dist);
  const top = px.slice(0, Math.max(1, Math.floor(px.length * 0.06)));
  const avg = (k: "r" | "g" | "b") => top.reduce((a, p) => a + p[k], 0) / top.length;
  return rgbToHex(avg("r"), avg("g"), avg("b"));
}

/** Negro o blanco según el contraste con el fondo. */
export function contrastTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
}
