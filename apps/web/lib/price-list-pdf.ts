import { apiClient } from "@/lib/api-client";
import { normalizePriceListKey, type PriceType } from "@/lib/order-calculator/price-types";
import { jpegToPdf, loadImage, renderPriceListJpeg } from "@/lib/price-list-render";
import type { PriceListTemplate } from "@/lib/types";

export {
  contrastTextColor,
  jpegToPdf,
  loadImage,
  renderPriceListJpeg,
  sampleCoverColor,
  sampleTextColor,
} from "@/lib/price-list-render";

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
