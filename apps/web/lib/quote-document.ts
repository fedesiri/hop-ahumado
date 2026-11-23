import { jpegToPdf, loadImage } from "@/lib/price-list-render";
import type { Quote, QuoteItem } from "@/lib/types";

/**
 * Presupuesto para el cliente (PDF + imagen).
 *
 * Para sumar un tipo nuevo de presupuesto (ej. por kilo, catering fijo) se agrega una entrada en
 * DOC_TYPES: título, texto de la pastilla, etiqueta del valor por unidad e info general por defecto.
 * El dibujo es el mismo para todos.
 */

export interface DocTypeConfig {
  /** Título grande del documento. */
  title: string;
  /** Nombre del menú si el presupuesto no tiene uno. */
  defaultMenuName: string;
  /** Pastilla debajo del título (ej. "Cantidad de personas: 50"); null si no aplica. */
  badge: (quote: Quote) => { label: string; value: string } | null;
  /** Texto bajo el total (ej. "Valor por persona"). */
  perUnitLabel: string;
  /** Viñetas de "Información general" que se precargan en un presupuesto nuevo. Admite {personas}, {validez} y {sena}. */
  defaultInfoLines: string[];
}

export const DOC_TYPES: Record<string, DocTypeConfig> = {
  EVENTO: {
    title: "Presupuesto para Evento",
    defaultMenuName: "Menú",
    badge: (q) => (q.peopleCount ? { label: "Cantidad de personas", value: String(q.peopleCount) } : null),
    perUnitLabel: "Valor por persona",
    defaultInfoLines: [
      "Propuesta estimada para {personas} personas.",
      "Los sándwiches se entregan listos para consumir.",
      "Las cantidades pueden ajustarse según las características del evento.",
      "Envío gratuito dentro de la ciudad de Gualeguaychú.",
      "Presupuesto válido por {validez} días. La fecha se reserva con el {sena}% de seña.",
    ],
  },
};

export const DEFAULT_DOC_TYPE = "EVENTO";
export const FOOTER_TEXT = "ALUMO Carnes Ahumadas • Gualeguaychú, Entre Ríos";

export function getDocType(type?: string | null): DocTypeConfig {
  return DOC_TYPES[type ?? DEFAULT_DOC_TYPE] ?? DOC_TYPES[DEFAULT_DOC_TYPE];
}

export function defaultInfoText(type?: string | null): string {
  return getDocType(type).defaultInfoLines.join("\n");
}

/** Reemplaza {personas}, {validez} y {sena} por los datos del presupuesto. */
export function fillInfoTokens(line: string, quote: Pick<Quote, "peopleCount" | "validityDays" | "depositPct">): string {
  const sena = Math.round((quote.depositPct ?? 0.5) * 100);
  return line
    .replace(/\{personas\}/g, quote.peopleCount ? String(quote.peopleCount) : "—")
    .replace(/\{validez\}/g, String(quote.validityDays ?? 7))
    .replace(/\{sena\}/g, String(sena));
}

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const formatMoney = (n: number) => `$ ${nf.format(Math.round(n))}`;
const formatQty = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

const UNIT_SUFFIX: Record<string, string> = { KG: "kg", L: "L", G: "g", ML: "ml" };

interface Segment {
  text: string;
  bold?: boolean;
}

interface DocLine {
  segments: Segment[];
  options: string[];
}

/** Línea del "Incluye" para un ítem: "210 sándwiches (detalle)." o "50 empanadas a elección:" + opciones. */
export function itemToLine(item: QuoteItem): DocLine {
  const unit = item.product ? UNIT_SUFFIX[item.product.unit] : undefined;
  const name = item.docLabel?.trim() || item.product?.name || "Producto";
  const qty = formatQty(item.quantity);
  // Un producto por peso sin nombre propio se lee "5 kg de Brisket en Lonjas".
  const bold = unit && !item.docLabel?.trim() ? `${qty} ${unit} de ${name}` : `${qty} ${name}`;
  const options = (item.docOptions ?? []).map((o) => o.trim()).filter(Boolean);
  const detail = item.docDetail?.trim() ?? "";
  // Con sub-lista la línea termina en ":"; sin ella, en punto.
  if (options.length > 0) {
    if (!detail) return { segments: [{ text: `${bold}:`, bold: true }], options };
    const d = detail.endsWith(":") ? detail : `${detail}:`;
    return { segments: [{ text: bold, bold: true }, { text: ` ${d}` }], options };
  }
  if (!detail) return { segments: [{ text: bold, bold: true }], options };
  return { segments: [{ text: bold, bold: true }, { text: ` ${/[.!?]$/.test(detail) ? detail : `${detail}.`}` }], options };
}

export interface QuoteDocModel {
  title: string;
  badge: { label: string; value: string } | null;
  menuName: string;
  lines: DocLine[];
  total: number;
  perUnit: number | null;
  perUnitLabel: string;
  info: string[];
  footer: string;
}

export function buildQuoteDocModel(quote: Quote): QuoteDocModel {
  const cfg = getDocType(quote.docType);
  const infoText = quote.infoLines != null && quote.infoLines.trim() ? quote.infoLines : defaultInfoText(quote.docType);
  return {
    title: cfg.title,
    badge: cfg.badge(quote),
    menuName: quote.menuName?.trim() || cfg.defaultMenuName,
    lines: quote.items.map(itemToLine),
    total: quote.totals.total,
    perUnit: quote.totals.pricePerPerson,
    perUnitLabel: cfg.perUnitLabel,
    info: infoText
      .split("\n")
      .map((l) => fillInfoTokens(l.trim(), quote))
      .filter(Boolean),
    footer: FOOTER_TEXT,
  };
}

// ───────────────────────── dibujo ─────────────────────────

const COLORS = {
  bg: "#f7f3ec",
  text: "#2b2623",
  muted: "#6b635b",
  sub: "#3d3733",
  border: "#8c8275",
  headerBg: "#dcd3c4",
  pill: "#e6dfd3",
  dash: "#c4baab",
};

const FAMILY = `"Montserrat", "Helvetica Neue", Arial, sans-serif`;
const font = (weight: number, size: number) => `${weight} ${size}px ${FAMILY}`;

/** Ancho de diseño (unidades) y escala a píxeles: salen 1080 px de ancho, bueno para WhatsApp. */
const PAGE_W = 720;
const SCALE = 1.5;
const MARGIN = 20;
const CARD_X = MARGIN;
const CARD_W = PAGE_W - MARGIN * 2;

let fontsPromise: Promise<void> | null = null;
/** Carga Montserrat; si no hay red, el dibujo sigue con la fuente de respaldo. */
function ensureFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    try {
      if (!document.getElementById("quote-doc-font")) {
        const link = document.createElement("link");
        link.id = "quote-doc-font";
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap";
        document.head.appendChild(link);
      }
      const load = Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 16px "Montserrat"`)));
      await Promise.race([load, new Promise((r) => setTimeout(r, 4000))]);
    } catch {
      // se usa la fuente de respaldo
    }
  })();
  return fontsPromise;
}

function wrapRich(ctx: CanvasRenderingContext2D, segments: Segment[], maxW: number, size: number, baseWeight = 400): Segment[][] {
  const words: Segment[] = [];
  for (const seg of segments) {
    for (const w of seg.text.split(/(\s+)/)) if (w !== "") words.push({ text: w, bold: seg.bold });
  }
  const lines: Segment[][] = [[]];
  let width = 0;
  for (const w of words) {
    ctx.font = font(w.bold ? 700 : baseWeight, size);
    const ww = ctx.measureText(w.text).width;
    const isSpace = /^\s+$/.test(w.text);
    if (!isSpace && width + ww > maxW && width > 0) {
      lines.push([]);
      width = 0;
    }
    if (isSpace && width === 0) continue;
    lines[lines.length - 1].push(w);
    width += ww;
  }
  return lines;
}

function drawRichLine(ctx: CanvasRenderingContext2D, line: Segment[], x: number, y: number, size: number, baseWeight = 400) {
  let cx = x;
  for (const seg of line) {
    ctx.font = font(seg.bold ? 700 : baseWeight, size);
    ctx.fillText(seg.text, cx, y);
    cx += ctx.measureText(seg.text).width;
  }
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0) - spacing;
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  let x = cx - spacedWidth(ctx, text, spacing) / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dibuja todo el documento; con `dry` solo mide y devuelve el alto necesario (unidades de diseño). */
function paint(ctx: CanvasRenderingContext2D, m: QuoteDocModel, logo: HTMLImageElement | null, dry: boolean, height: number): number {
  const cx = PAGE_W / 2;
  ctx.textBaseline = "alphabetic";
  if (!dry) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, PAGE_W, height);
  }
  let y = 40;

  // Logo
  if (logo) {
    const lh = 120;
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
    if (!dry) ctx.drawImage(logo, cx - lw / 2, y, lw, lh);
    y += lh + 16;
  }

  // Título
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = font(400, 24);
  if (!dry) drawSpaced(ctx, m.title.toUpperCase(), cx, y + 22, 3);
  y += 22 + 20;

  // Pastilla
  if (m.badge) {
    const prefix = `👥  ${m.badge.label}: `;
    ctx.font = font(400, 16);
    const w1 = ctx.measureText(prefix).width;
    ctx.font = font(700, 16);
    const w2 = ctx.measureText(m.badge.value).width;
    const pw = w1 + w2 + 48;
    const ph = 44;
    if (!dry) {
      ctx.fillStyle = COLORS.pill;
      roundRect(ctx, cx - pw / 2, y, pw, ph, 12);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = font(400, 16);
      ctx.fillText(prefix, cx - pw / 2 + 24, y + 28);
      ctx.font = font(700, 16);
      ctx.fillText(m.badge.value, cx - pw / 2 + 24 + w1, y + 28);
    }
    y += ph;
  }
  y += 28;

  // Tarjeta del menú: primero se mide el contenido para saber el alto.
  const bodyX = CARD_X + 48;
  const textW = CARD_W - 96;
  const cardTop = y;
  const headerH = 52;
  let by = cardTop + headerH + 32;
  const bodyStart = by;

  const LABEL = 15;
  const ITEM = 15;
  const LH = 22.5; // 15px * 1.5

  const draws: Array<() => void> = [];
  draws.push(() => {
    ctx.fillStyle = COLORS.text;
    ctx.font = font(700, LABEL);
    ctx.fillText("INCLUYE:", bodyX, bodyStart + 15);
  });
  by += LABEL + 16;

  for (const line of m.lines) {
    const wrapped = wrapRich(ctx, line.segments, textW - 20, ITEM);
    const top = by;
    draws.push(() => {
      ctx.fillStyle = COLORS.text;
      ctx.font = font(400, ITEM);
      ctx.fillText("•", bodyX + 2, top + 15);
      wrapped.forEach((l, i) => {
        ctx.fillStyle = COLORS.text;
        drawRichLine(ctx, l, bodyX + 20, top + 15 + i * LH, ITEM);
      });
    });
    by += wrapped.length * LH;
    if (line.options.length) {
      by += 8;
      for (const opt of line.options) {
        const ow = wrapRich(ctx, [{ text: opt }], textW - 20 - 24 - 14, ITEM);
        const otop = by;
        draws.push(() => {
          ctx.fillStyle = COLORS.sub;
          ctx.font = font(400, ITEM);
          ctx.fillText("◦", bodyX + 20 + 6, otop + 15);
          ow.forEach((l, i) => drawRichLine(ctx, l, bodyX + 20 + 24, otop + 15 + i * LH, ITEM));
        });
        by += ow.length * LH + 6;
      }
      by += 2;
    }
    by += 12;
  }

  // Precios
  by += 20; // separación antes del bloque
  const priceTop = by;
  const hasPerUnit = m.perUnit != null;
  draws.push(() => {
    ctx.strokeStyle = COLORS.dash;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(CARD_X + 48, priceTop);
    ctx.lineTo(CARD_X + CARD_W - 48, priceTop);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.text;
    ctx.font = font(700, 22);
    const t = `TOTAL: ${formatMoney(m.total)}`;
    ctx.fillText(t, cx - ctx.measureText(t).width / 2, priceTop + 20 + 22);
    if (hasPerUnit) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = font(400, 14);
      const p = `${m.perUnitLabel}: ${formatMoney(m.perUnit as number)}`;
      ctx.fillText(p, cx - ctx.measureText(p).width / 2, priceTop + 20 + 22 + 24);
    }
  });
  by = priceTop + 20 + 22 + (hasPerUnit ? 24 + 6 : 6) + 32;

  const cardH = by - cardTop;
  if (!dry) {
    ctx.fillStyle = COLORS.bg;
    roundRect(ctx, CARD_X, cardTop, CARD_W, cardH, 14);
    ctx.fill();
    ctx.save();
    roundRect(ctx, CARD_X, cardTop, CARD_W, cardH, 14);
    ctx.clip();
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(CARD_X, cardTop, CARD_W, headerH);
    ctx.restore();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    roundRect(ctx, CARD_X + 0.5, cardTop + 0.5, CARD_W - 1, cardH - 1, 14);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = font(500, 20);
    ctx.fillText(m.menuName, cx - ctx.measureText(m.menuName).width / 2, cardTop + 33);
    draws.forEach((d) => d());
  }
  y = cardTop + cardH + 28;

  // Información general
  const infoX = CARD_X + 24;
  const infoW = CARD_W - 48;
  if (!dry) {
    ctx.fillStyle = COLORS.text;
    ctx.font = font(700, 15);
    ctx.fillText("Información General", infoX, y + 15);
  }
  y += 15 + 12;
  for (const text of m.info) {
    const wrapped = wrapRich(ctx, [{ text }], infoW - 14, 14);
    if (!dry) {
      ctx.fillStyle = COLORS.text;
      ctx.font = font(700, 14);
      ctx.fillText("•", infoX, y + 14);
      wrapped.forEach((l, i) => drawRichLine(ctx, l, infoX + 14, y + 14 + i * 21, 14));
    }
    y += wrapped.length * 21 + 6;
  }

  // Pie
  y += 26;
  if (!dry) {
    ctx.strokeStyle = COLORS.pill;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(CARD_X, y);
    ctx.lineTo(CARD_X + CARD_W, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(400, 12);
    ctx.fillText(m.footer, cx - ctx.measureText(m.footer).width / 2, y + 16 + 12);
  }
  y += 16 + 12 + 40;
  return y;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), type, quality),
  );
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch("/logo-alumo.png");
    if (!res.ok) return null;
    return await loadImage(await res.blob());
  } catch {
    return null;
  }
}

export async function renderQuoteJpeg(model: QuoteDocModel): Promise<{ blob: Blob; width: number; height: number }> {
  await ensureFonts();
  const logo = await loadLogo();
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Tu navegador no pudo preparar la imagen");
  const designH = Math.ceil(paint(probe, model, logo, true, 0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_W * SCALE);
  canvas.height = Math.round(designH * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo preparar la imagen");
  ctx.scale(SCALE, SCALE);
  paint(ctx, model, logo, false, designH);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.93);
  return { blob, width: canvas.width, height: canvas.height };
}

export async function generateQuoteDocument(quote: Quote): Promise<{ pdf: Blob; jpeg: Blob }> {
  const { blob, width, height } = await renderQuoteJpeg(buildQuoteDocModel(quote));
  const pdf = await jpegToPdf(blob, width, height);
  return { pdf, jpeg: blob };
}

export function quoteFileBase(quote: Quote): string {
  const who = (quote.customer?.name ?? quote.clientName ?? "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Presupuesto-${who || "cliente"}`;
}
