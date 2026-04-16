import type { RecipeItem } from "@/lib/types";

/** Una fila de receta por producto final (combo / elaborado). */
export type RecipeIngredientRow = { ingredientId: string; quantity: number };

/**
 * Demanda neta de stock por producto (insumo o producto sin receta), según líneas de pedido y recetas.
 * Si un producto tiene receta, no suma demanda sobre ese productId: solo sobre ingredientId.
 */
export function expandOrderLineDemands(
  items: { productId: string; quantity: number }[],
  recipesByProductId: Record<string, RecipeIngredientRow[]>,
): Record<string, number> {
  const demand: Record<string, number> = {};
  for (const item of items) {
    const q = Number(item.quantity);
    if (!Number.isFinite(q) || q <= 0) continue;
    const recipe = recipesByProductId[item.productId];
    if (!recipe?.length) {
      demand[item.productId] = (demand[item.productId] ?? 0) + q;
      continue;
    }
    for (const row of recipe) {
      const take = q * row.quantity;
      demand[row.ingredientId] = (demand[row.ingredientId] ?? 0) + take;
    }
  }
  return demand;
}

export async function fetchRecipesByProductIds(
  fetchPage: (page: number, limit: number, productId?: string) => Promise<{ data: RecipeItem[] }>,
  productIds: string[],
): Promise<Record<string, RecipeIngredientRow[]>> {
  const unique = [...new Set(productIds)];
  const out: Record<string, RecipeIngredientRow[]> = {};
  for (const id of unique) {
    const res = await fetchPage(1, 100, id);
    const rows = res.data ?? [];
    out[id] = rows.map((r) => ({
      ingredientId: r.ingredientId,
      quantity: Number(r.quantity),
    }));
  }
  return out;
}
