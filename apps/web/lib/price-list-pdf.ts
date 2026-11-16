import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { normalizePriceListKey, type PriceType } from "@/lib/order-calculator/price-types";
import type { PriceListSlot, PriceListTemplate } from "@/lib/types";

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

/** Trae todos los precios vigentes de una lista y devuelve productId → valor. */
export async function fetchPriceMap(listType: PriceType, businessLineId: string): Promise<Map<string, number>> {
  const key = normalizePriceListKey(listType);
  const map = new Map<string, number>();
  const newest = new Map<string, number>();
  let page = 1;
  let totalPages = 1;
  do {
    const res = await apiClient.getPrices(page, 100, undefined, true, undefined, listType, businessLineId);
    for (const p of res.data) {
      if (normalizePriceListKey(p.description) !== key) continue;
      const ts = new Date(p.createdAt).getTime();
      if (!newest.has(p.productId) || ts >= (newest.get(p.productId) ?? 0)) {
        newest.set(p.productId, ts);
        map.set(p.productId, Number(p.value));
      }
    }
    totalPages = res.meta.totalPages;
    page += 1;
  } while (page <= totalPages);
  return map;
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: PriceListSlot,
  W: number,
  H: number,
  value: number | undefined,
) {
  const x = slot.x * W;
  const y = slot.y * H;
  const w = slot.w * W;
  const h = slot.h * H;

  ctx.fillStyle = slot.coverColor;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

  const text = value === undefined ? "—" : formatCurrency(value);
  let size = h * 0.78 * slot.fontScale;
  const font = (s: number) => `700 ${s}px "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font(size);
  const maxW = w * 0.96;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = font(size);
  }
  ctx.fillStyle = slot.textColor;
  ctx.textBaseline = "middle";
  ctx.textAlign = slot.align;
  const tx = slot.align === "left" ? x + w * 0.02 : slot.align === "right" ? x + w * 0.98 : x + w / 2;
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
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo preparar la imagen");
  ctx.drawImage(image, 0, 0, W, H);
  for (const slot of slots) drawSlot(ctx, slot, W, H, prices.get(slot.productId));
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

export async function generatePriceListPdf(
  template: PriceListTemplate,
  listType: PriceType,
): Promise<{ pdf: Blob; jpeg: Blob; missing: number }> {
  const [imageBlob, prices] = await Promise.all([
    apiClient.getPriceListTemplateImage(template.id),
    fetchPriceMap(listType, template.businessLineId),
  ]);
  const image = await loadImage(imageBlob);
  const { blob, width, height } = await renderPriceListJpeg(image, template.slots, prices);
  const pdf = await jpegToPdf(blob, width, height);
  const missing = template.slots.filter((s) => !prices.has(s.productId)).length;
  return { pdf, jpeg: blob, missing };
}

/** Promedio por canal de los píxeles que rodean la zona: es el color de fondo a usar para tapar el precio. */
export function sampleCoverColor(image: HTMLImageElement, slot: Pick<PriceListSlot, "x" | "y" | "w" | "h">): string {
  const scale = Math.min(1, 1500 / Math.max(image.naturalWidth, image.naturalHeight));
  const W = Math.max(1, Math.round(image.naturalWidth * scale));
  const H = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#ffffff";
  ctx.drawImage(image, 0, 0, W, H);

  const x0 = Math.floor(slot.x * W);
  const y0 = Math.floor(slot.y * H);
  const x1 = Math.ceil((slot.x + slot.w) * W);
  const y1 = Math.ceil((slot.y + slot.h) * H);
  const pad = 3;
  const px: [number, number][] = [];
  for (let x = x0; x <= x1; x += 2) {
    px.push([x, y0 - pad], [x, y1 + pad]);
  }
  for (let y = y0; y <= y1; y += 2) {
    px.push([x0 - pad, y], [x1 + pad, y]);
  }
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const [x, y] of px) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d = ctx.getImageData(x, y, 1, 1).data;
    rs.push(d[0]);
    gs.push(d[1]);
    bs.push(d[2]);
  }
  if (!rs.length) return "#ffffff";
  const median = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
  return rgbToHex(median(rs), median(gs), median(bs));
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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
