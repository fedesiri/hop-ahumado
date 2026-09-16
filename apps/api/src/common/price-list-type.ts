export const PRICE_LIST_TYPES = ["mayorista", "minorista", "fabrica", "catering"] as const;

export type PriceListType = (typeof PRICE_LIST_TYPES)[number];
