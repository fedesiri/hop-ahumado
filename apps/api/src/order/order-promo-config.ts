/**
 * Promo por volumen. Primera etapa: valores en código; más adelante se puede mover a BD o config remota.
 *
 * Debe coincidir con `apps/web/lib/order-calculator/order-promo-config.ts` para que API y web validen igual.
 */
export const ORDER_PROMO_CONFIG = {
  thresholdArs: 65_000,
  thresholdCategoryNames: ["Cerveza"] as const,
  promoUnitMayoristaMinoristaEstucheCopa: 6500,
  promoUnitMayoristaMinoristaEstucheVaso: 4100,
} as const;
