/**
 * Detección automática de precios en una imagen de lista:
 * a partir de las palabras que devuelve el OCR (con su posición) encuentra cada "nombre ... $ precio",
 * detecta el título de columna (UN LITRO / MEDIO LITRO) y empareja cada nombre con un producto.
 * Son funciones puras para poder probarlas sin navegador.
 */

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Section = "litro" | "medio" | null;

export interface DetectedRow {
  name: string;
  section: Section;
  /** Caja del precio viejo (en píxeles de la imagen). */
  price: Box;
  /** Valor leído del precio viejo (solo para desempatar litro vs medio litro). */
  value: number;
}

const PRICE_RE = /^\$?\d{1,3}[.,]?\d{3}$/;
const DOLLAR_RE = /^[$S5]$/;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/½]+/g, " ")
    .trim();
}

function union(words: OcrWord[]): Box {
  return {
    x0: Math.min(...words.map((w) => w.x0)),
    y0: Math.min(...words.map((w) => w.y0)),
    x1: Math.max(...words.map((w) => w.x1)),
    y1: Math.max(...words.map((w) => w.y1)),
  };
}

function groupLines(words: OcrWord[]): OcrWord[][] {
  const sorted = [...words].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const lines: { cy: number; h: number; words: OcrWord[] }[] = [];
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2;
    const h = w.y1 - w.y0;
    const line = lines.find((l) => Math.abs(l.cy - cy) < 0.45 * Math.max(l.h, h));
    if (line) {
      line.words.push(w);
      line.cy = line.words.reduce((a, x) => a + (x.y0 + x.y1) / 2, 0) / line.words.length;
      line.h = Math.max(line.h, h);
    } else {
      lines.push({ cy, h, words: [w] });
    }
  }
  return lines.map((l) => l.words.sort((a, b) => a.x0 - b.x0));
}

interface Header {
  section: Exclude<Section, null>;
  box: Box;
}

function findHeaders(lines: OcrWord[][]): Header[] {
  const headers: Header[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (!normalize(line[i].text).startsWith("litr")) continue;
      const prev = line[i - 1];
      if (!prev) continue;
      const p = normalize(prev.text);
      const section: Header["section"] | null = p.startsWith("med") ? "medio" : p === "un" || p === "1" ? "litro" : null;
      if (section) headers.push({ section, box: union([prev, line[i]]) });
    }
  }
  return headers;
}

export function detectRows(words: OcrWord[]): DetectedRow[] {
  const lines = groupLines(words.filter((w) => w.text.trim().length > 0));
  const headers = findHeaders(lines);
  const rows: DetectedRow[] = [];

  for (const line of lines) {
    let nameWords: OcrWord[] = [];
    for (let i = 0; i < line.length; i++) {
      const w = line[i];
      const t = w.text.replace(/\s/g, "");
      const next = line[i + 1];
      let priceWords: OcrWord[] | null = null;
      if (PRICE_RE.test(t) && /\d/.test(t)) {
        priceWords = [w];
        const prev = nameWords[nameWords.length - 1];
        // "$" suelto justo antes del número
        if (!t.startsWith("$") && prev && DOLLAR_RE.test(prev.text.trim()) && w.x0 - prev.x1 < 1.2 * (w.y1 - w.y0)) {
          nameWords = nameWords.slice(0, -1);
          priceWords = [prev, w];
        }
      } else if (DOLLAR_RE.test(t) && next && /^\d{1,3}[.,]?\d{3}$/.test(next.text.replace(/\s/g, ""))) {
        priceWords = [w, next];
        i += 1;
      }

      if (!priceWords) {
        nameWords.push(w);
        continue;
      }
      const price = union(priceWords);
      if (nameWords.length > 0) {
        const nameBox = union(nameWords);
        const cx = (nameBox.x0 + price.x1) / 2;
        const above = headers.filter((h) => h.box.y1 <= price.y0);
        const header = above.sort(
          (a, b) =>
            Math.abs((a.box.x0 + a.box.x1) / 2 - cx) - Math.abs((b.box.x0 + b.box.x1) / 2 - cx),
        )[0];
        // el título debe estar en la misma columna (horizontalmente cerca)
        const inColumn = header && cx >= header.box.x0 - 0.15 * (header.box.x1 - header.box.x0) - 120 && cx <= header.box.x1 + 0.6 * (header.box.x1 - header.box.x0) + 120;
        rows.push({
          name: nameWords.map((n) => n.text).join(" "),
          section: inColumn ? header.section : null,
          price,
          value: Number(priceWords.map((p) => p.text).join("").replace(/\D/g, "")) || 0,
        });
      }
      nameWords = [];
    }
  }
  return rows;
}

// ───────────────────────── Emparejado con productos ─────────────────────────

const SIZE_TOKENS = new Set([
  "1", "l", "lt", "lts", "litro", "litros", "un", "500", "ml", "cc", "medio", "1000", "1l", "1lt", "1lts",
  "500ml", "1000ml", "1/2", "½", "x", "de",
]);

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function tokensEqual(a: string, b: string): boolean {
  if (a === b) return true;
  // la tolerancia a errores del OCR solo se aplica a palabras largas: "dipa" y "sipa" son productos distintos
  if (a.length >= 5 && b.length >= 5) return levenshtein(a, b) <= 1;
  return false;
}

/** Abreviaturas habituales en los nombres de producto: "Session IPA" = "SIPA", "Doble IPA" = "DIPA". */
function canonicalize(s: string): string {
  return normalize(s)
    .replace(/\bsessions? ipa\b/g, "sipa")
    .replace(/\b(doble|double|dobles) ipa\b/g, "dipa");
}

function baseTokens(s: string): string[] {
  return canonicalize(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !SIZE_TOKENS.has(t));
}

/**
 * El OCR a veces pega basura delante del nombre (partes de una botella, íconos). Se descartan las palabras
 * cortas que no aparecen en ningún producto; las largas se conservan para no emparejar mal un nombre desconocido.
 */
function dropNoise(tokens: string[], vocabulary: string[]): string[] {
  return tokens.filter((t) => t.length > 3 || vocabulary.some((v) => tokensEqual(t, v)));
}

export function productSize(name: string): Section {
  const n = normalize(name);
  if (/\b(500|medio|1\/2)\b|½|\b500\s?(ml|cc)\b/.test(n)) return "medio";
  if (/\b1\s?(l|lt|lts|litro|litros)\b|\blitro\b|\b1000\b|\bun litro\b/.test(n)) return "litro";
  return null;
}

export interface MatchableProduct {
  id: string;
  name: string;
}

export interface MatchResult<P extends MatchableProduct> {
  product: P;
  score: number;
}

export function matchProduct<P extends MatchableProduct>(
  row: Pick<DetectedRow, "name" | "section">,
  products: P[],
): MatchResult<P> | null {
  const vocabulary = [...new Set(products.flatMap((p) => baseTokens(p.name)))];
  const rowTokens = dropNoise(baseTokens(row.name), vocabulary);
  if (rowTokens.length === 0) return null;
  let best: MatchResult<P> | null = null;

  for (const product of products) {
    const size = productSize(product.name);
    if (row.section && size && size !== row.section) continue; // litro vs medio: nunca cruzar
    const prodTokens = baseTokens(product.name);
    if (prodTokens.length === 0) continue;
    const common = rowTokens.filter((t) => prodTokens.some((p) => tokensEqual(t, p))).length;
    if (common === 0) continue;
    const dice = (2 * common) / (rowTokens.length + prodTokens.length);
    const coverage = common / rowTokens.length;
    const nameScore = 0.5 * dice + 0.5 * coverage;
    if (nameScore < 0.6) continue; // el tamaño solo desempata, no rescata nombres distintos
    const score = nameScore + (row.section && size === row.section ? 0.1 : 0);
    if (!best || score > best.score) best = { product, score };
  }
  return best;
}

export interface DetectionResult<P extends MatchableProduct> {
  matched: { row: DetectedRow; product: P; score: number }[];
  unmatched: DetectedRow[];
}

/**
 * Empareja cada fila con un producto. Si no se pudo leer el título de columna (UN LITRO / MEDIO LITRO)
 * y el mismo nombre aparece dos veces, la columna con el precio más bajo es el medio litro.
 * Si dos filas caen en el mismo producto, gana la de mejor puntaje.
 */
export function matchRows<P extends MatchableProduct>(rows: DetectedRow[], products: P[]): DetectionResult<P> {
  const resolved: DetectedRow[] = rows.map((r) => ({ ...r }));

  const ambiguous = resolved.filter((r) => {
    if (r.section) return false;
    const l = matchProduct({ name: r.name, section: "litro" }, products);
    const m = matchProduct({ name: r.name, section: "medio" }, products);
    return !!l && !!m && l.product.id !== m.product.id && Math.abs(l.score - m.score) < 0.05;
  });
  const groups = new Map<string, DetectedRow[]>();
  for (const r of ambiguous) {
    const key = baseTokens(r.name).join(" ");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const unresolved = new Set<DetectedRow>();
  for (const group of groups.values()) {
    if (group.length === 2 && group[0].value !== group[1].value) {
      const [low, high] = [...group].sort((a, b) => a.value - b.value);
      low.section = "medio";
      high.section = "litro";
    } else {
      group.forEach((r) => unresolved.add(r));
    }
  }

  const bestByProduct = new Map<string, { row: DetectedRow; product: P; score: number }>();
  const unmatched: DetectedRow[] = [];
  for (const row of resolved) {
    const match = unresolved.has(row) ? null : matchProduct(row, products);
    if (!match) {
      unmatched.push(row);
      continue;
    }
    const cur = bestByProduct.get(match.product.id);
    if (!cur || match.score > cur.score) {
      if (cur) unmatched.push(cur.row);
      bestByProduct.set(match.product.id, { row, product: match.product, score: match.score });
    } else {
      unmatched.push(row);
    }
  }
  return { matched: [...bestByProduct.values()], unmatched };
}

// ───────────────────────── Lista de precios de la imagen ─────────────────────────

export type ListName = "mayorista" | "minorista";

export interface ListHint {
  list: ListName;
  /** "alumo": la imagen menciona a Alumo (siempre mayorista). "titulo": dice MAYORISTA / MINORISTA. */
  reason: "alumo" | "titulo";
}

/**
 * Qué lista de precios corresponde a la imagen según su texto:
 * - si menciona a Alumo ("ALUMO" o "Disponible contratando … para tu evento"), siempre es mayorista;
 * - si no, el título MAYORISTA / MINORISTA.
 */
export function detectListHint(words: OcrWord[]): ListHint | null {
  const tokens = words.map((w) => normalize(w.text)).filter(Boolean);
  const has = (pred: (t: string) => boolean) => tokens.some(pred);

  const alumo =
    has((t) => t.length >= 4 && t.length <= 6 && tokensEqual(t, "alumo")) ||
    (has((t) => t.startsWith("contrat")) && has((t) => t.startsWith("evento")));
  if (alumo) return { list: "mayorista", reason: "alumo" };

  const may = has((t) => t.length >= 7 && tokensEqual(t, "mayorista"));
  const min = has((t) => t.length >= 7 && tokensEqual(t, "minorista"));
  if (may && !min) return { list: "mayorista", reason: "titulo" };
  if (min && !may) return { list: "minorista", reason: "titulo" };
  return null;
}

/**
 * Respaldo cuando el título no se lee: compara los precios viejos de la imagen con las listas
 * mayorista y minorista actuales de cada producto, y elige la que más se parece.
 */
export function voteListByPrices(
  rows: { productId: string; value: number }[],
  prices: Record<ListName, Map<string, number>>,
): ListName | null {
  const votes: Record<ListName, number> = { mayorista: 0, minorista: 0 };
  for (const { productId, value } of rows) {
    const may = prices.mayorista.get(productId);
    const min = prices.minorista.get(productId);
    if (!value || !may || !min) continue;
    const dMay = Math.abs(value - may) / may;
    const dMin = Math.abs(value - min) / min;
    if (dMay < dMin) votes.mayorista++;
    else if (dMin < dMay) votes.minorista++;
  }
  const total = votes.mayorista + votes.minorista;
  if (total < 3) return null;
  const winner: ListName = votes.mayorista >= votes.minorista ? "mayorista" : "minorista";
  return votes[winner] / total >= 0.7 ? winner : null;
}
