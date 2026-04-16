/**
 * Promo por volumen. Primera etapa: valores en código; más adelante se puede mover a BD o config remota.
 *
 * - `thresholdCategoryNames` vacío → el umbral suma todo el carrito excepto combos regalo (Estuche/Copa, Estuche/Vaso).
 * - Con nombres → solo productos cuya categoría en BD coincida (normalizado) suman al umbral.
 */
export const ORDER_PROMO_CONFIG = {
  thresholdArs: 65_000,
  thresholdCategoryNames: ["Cerveza"] as const,
  promoUnitMayoristaMinoristaEstucheCopa: 6500,
  promoUnitMayoristaMinoristaEstucheVaso: 4100,
} as const;
