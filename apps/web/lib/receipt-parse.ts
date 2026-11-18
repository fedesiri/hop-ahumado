/**
 * Interpreta el texto que devuelve el OCR de un ticket/factura de compra (formato argentino):
 * total, fecha, proveedor, medio de pago, categoría sugerida y renglones de producto.
 * Son funciones puras, sin navegador, para poder probarlas con texto de ejemplo.
 */
import { matchProduct, normalize, type MatchableProduct } from "@/lib/price-list-detect";

export interface ParsedReceipt {
  /** YYYY-MM-DD */
  date: string | null;
  total: number | null;
  supplier: string | null;
  /** "Efectivo" | "Transferencia" | "Mercado Pago" | "Tarjeta de crédito" */
  paymentMethod: string | null;
  /** Nombre de categoría de Flujo de caja (egresos). */
  category: string | null;
  /** Renglones de texto con letras y sin importes grandes, útiles para armar una descripción. */
  itemLines: string[];
}

export interface ReceiptProductLine<P extends MatchableProduct> {
  product: P;
  quantity: number;
  source: string;
}

/** "1.234,56" · "1,234.56" · "1234,5" · "$ 12.500" → número, o null si no parece un importe. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const decimalSep = lastDot > lastComma ? "." : lastComma > lastDot ? "," : null;
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    const decimals = s.length - idx - 1;
    if (decimals === 3 && (s.match(/[.,]/g) ?? []).length === 1) {
      s = s.replace(/[.,]/g, ""); // "12.500" → miles
    } else {
      s = s.slice(0, idx).replace(/[.,]/g, "") + "." + s.slice(idx + 1);
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const AMOUNT_RE = /\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\$?\s?\d+(?:[.,]\d{1,2})?/g;

function amountsIn(line: string): number[] {
  return (line.match(AMOUNT_RE) ?? [])
    .map(parseAmount)
    .filter((n): n is number => n !== null && n > 0);
}

export function findTotal(lines: string[]): number | null {
  const candidates: number[] = [];
  lines.forEach((line, i) => {
    const n = normalize(line);
    if (!/\btotal\b/.test(n) || /subtotal|sub total|total iva|iva total|total items|total articulos/.test(n)) return;
    const found = amountsIn(line);
    // el importe puede venir en el renglón siguiente ("TOTAL" / "$ 12.500,00")
    const fromNext = found.length === 0 && lines[i + 1] ? amountsIn(lines[i + 1]) : [];
    candidates.push(...found, ...fromNext);
  });
  if (candidates.length > 0) return Math.max(...candidates);
  // sin la palabra TOTAL: el importe más grande del ticket (ignorando números enormes tipo CUIT / nº de comprobante)
  const all = lines.flatMap((l) => (/cuit|c\.u\.i\.t|cae|comprobante|nro|n°|tel/i.test(l) ? [] : amountsIn(l)));
  const plausible = all.filter((n) => n < 10_000_000);
  return plausible.length > 0 ? Math.max(...plausible) : null;
}

export function findDate(text: string, today = new Date()): string | null {
  const re = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  const found: Date[] = [];
  for (const m of text.matchAll(re)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2020) continue;
    const date = new Date(y, mo - 1, d);
    if (date.getMonth() !== mo - 1) continue;
    if (date.getTime() > today.getTime() + 24 * 3600 * 1000) continue; // un ticket no es del futuro
    found.push(date);
  }
  if (found.length === 0) return null;
  const best = found.sort((a, b) => b.getTime() - a.getTime())[0];
  return `${best.getFullYear()}-${String(best.getMonth() + 1).padStart(2, "0")}-${String(best.getDate()).padStart(2, "0")}`;
}

export function findPaymentMethod(text: string): string | null {
  const n = normalize(text);
  if (/mercado ?pago|\bmp\b|qr/.test(n)) return "Mercado Pago";
  if (/transferencia|\btransf\b|\bcbu\b/.test(n)) return "Transferencia";
  if (/tarjeta|debito|credito|visa|master ?card|maestro|cabal|naranja|amex/.test(n)) return "Tarjeta de crédito";
  if (/efectivo|contado|cash/.test(n)) return "Efectivo";
  return null;
}

const NOT_A_NAME = /cuit|c\.u\.i\.t|iva|factura|ticket|comprobante|fecha|hora|cajero|tel|www|http|@|ingresos brutos|inicio de act|responsable|consumidor final|original|duplicado|\bcod\b|nro|n°|punto de venta|\bpv\b/i;

export function findSupplier(lines: string[]): string | null {
  const head = lines.slice(0, 8);
  const legal = head.find((l) => /\b(s\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?\s?s\.?)\s*$/i.test(l.trim()) && /[a-záéíóú]{3}/i.test(l));
  const pick =
    legal ??
    head.find((l) => {
      const t = l.trim();
      const letters = (t.match(/[a-záéíóúñ]/gi) ?? []).length;
      return t.length >= 4 && letters >= 4 && letters / t.length > 0.6 && !NOT_A_NAME.test(t);
    });
  if (!pick) return null;
  return pick
    .replace(/[^\p{L}\p{N}\s.&'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\p{L})(\p{L}*)/gu, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase())
    .slice(0, 60);
}

const CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ["Carbón / Leña", /carbon|lena|leña|briqueta/],
  ["Packaging", /packaging|envase|caja|bolsa|frasco|botella|etiqueta|pote|vaso|film|descartable/],
  ["Transporte", /flete|nafta|combustible|ypf|shell|axion|puma|peaje|uber|cabify|remis|estacionamiento|viatico/],
  ["Marketing", /publicidad|impresion|imprenta|flyer|cartel|instagram|facebook|meta ads|gigantografia/],
  ["Servicios", /luz|edenor|edesur|gas natural|metrogas|agua|aysa|internet|telefon|claro|personal|movistar|alquiler|expensas/],
  ["Impuestos", /afip|arca|monotributo|iibb|rentas|municipal|tasa|impuesto/],
  ["Mantenimiento", /repuesto|reparacion|ferreteria|plomer|electricista|pintura|mantenimiento/],
  ["Equipamiento", /equipo|heladera|freezer|horno|parrilla|ahumador|maquina|balanza|cuchillo|olla/],
  ["Materia prima", /carniceria|frigorifico|carne|cerdo|vaca|pollo|chacinado|verduleria|verdura|fruta|mayorista|distribuidora|supermercado|super|dia|coto|carrefour|jumbo|disco|lacteo|harina|azucar|sal|especia|cerveza|malta|lupulo|levadura|bebida/],
];

export function suggestCategory(text: string): string | null {
  const n = normalize(text);
  for (const [name, re] of CATEGORY_KEYWORDS) if (re.test(n)) return name;
  return null;
}

export function parseReceiptText(text: string, today = new Date()): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const supplier = findSupplier(lines);
  const itemLines = lines.filter((l) => {
    const letters = (l.match(/[a-záéíóúñ]/gi) ?? []).length;
    return letters >= 4 && !NOT_A_NAME.test(l) && !/\btotal\b|subtotal|vuelto|\bpago\b|efectivo|tarjeta/i.test(l);
  });
  return {
    date: findDate(text, today),
    total: findTotal(lines),
    supplier,
    paymentMethod: findPaymentMethod(text),
    category: suggestCategory(`${supplier ?? ""} ${text}`),
    itemLines,
  };
}

/** Empareja renglones del ticket con productos del sistema y adivina la cantidad ("2 x", "x3", "1,500 kg"). */
export function matchReceiptProducts<P extends MatchableProduct>(
  itemLines: string[],
  products: P[],
): ReceiptProductLine<P>[] {
  const byProduct = new Map<string, ReceiptProductLine<P>>();
  for (const line of itemLines) {
    const name = line.replace(/[\d.,$%]+/g, " ").replace(/\b(x|kg|un|u|unid|lt|lts|gr)\b/gi, " ");
    const match = matchProduct({ name, section: null }, products);
    if (!match) continue;
    const q =
      line.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:x|u|un|kg)?\s+[a-záéíóú]/i) ??
      line.match(/\bx\s?(\d+(?:[.,]\d+)?)\b/i) ??
      line.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|un|u)\b/i);
    // en cantidades la coma siempre es decimal ("1,500 kg" = 1,5 kg)
    const quantity = q ? Number(q[1].replace(",", ".")) || 1 : 1;
    if (!byProduct.has(match.product.id)) {
      byProduct.set(match.product.id, { product: match.product, quantity: quantity > 0 && quantity < 10_000 ? quantity : 1, source: line });
    }
  }
  return [...byProduct.values()];
}
